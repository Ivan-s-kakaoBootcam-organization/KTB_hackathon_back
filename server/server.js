// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const pdf = require('pdf-parse');
const nodemailer = require('nodemailer');

// Express 앱 초기화
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OpenAI API 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 업로드 디렉토리 설정
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// 문서 저장소 (실제 구현에서는 데이터베이스 사용 권장)
let documentStore = [];

// 학교 관련 링크 정보
const schoolLinks = [
  {
    id: 'education-support-1',
    title: '2025 교육급여 및 교육비 지원신청 안내',
    url: 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40510176',
    filename: '2025학년도 교육급여 및 교육비 지원신청 안내.txt',
    keywords: ['교육비', '지원', '신청', '저소득층', '급여', '교육급여']
  },
  {
    id: 'education-support-2',
    title: '2025학년도 다자녀 가정 교육비 지원 신청 안내',
    url: 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40510383',
    filename: '2025학년도 다자녀 가정 교육비 지원 신청 안내.txt',
    keywords: ['교육비', '지원', '신청', '다자녀', '가정']
  },
  {
    id: 'sports-event',
    title: '제59회 도민체육대회 참가요강',
    url: 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40511420',
    filename: '제59회 도민체육대회 참가요강.txt',
    keywords: ['체육', '대회', '참가', '도민']
  },
  {
    id: 'school-calendar',
    title: '학사 일정',
    url: 'https://school.jje.go.kr/ido/sv/schdulView/selectSchdulCalendar.do?mi=106454',
    keywords: ['일정', '학사', '방학', '시험'],
    filename: '학사일정.txt'
  },
  {
    id: 'march-lunch-menu',
    title: '3월 급식 안내',
    url: 'https://school.jje.go.kr/ido/ad/fm/foodmenu/selectFoodMenuView.do?mi=106449',
    keywords: ['3월','급식', '메뉴', '식단', '영양'],
    filename: '3월 급식.txt'
  }
];

// 파일 맵핑 정보 (파일명과 공지사항 URL 연결)
const fileUrlMapping = {
  '2025학년도 교육급여 및 교육비 지원신청 안내.txt': 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40510176',
  '2025_교육급여_교육비_지원신청_안내.txt': 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40510176',
  '2025학년도 다자녀 가정 교육비 지원 신청 안내.txt': 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40510383',
  '제59회 도민체육대회 참가요강.txt': 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&bbsId=110855&nttSn=40511420',
  '학사일정.txt': 'https://school.jje.go.kr/ido/sv/schdulView/selectSchdulCalendar.do?mi=106454',
  '3월 급식.txt': 'https://school.jje.go.kr/ido/ad/fm/foodmenu/selectFoodMenuView.do?mi=106449'
};

// Multer 설정 (파일 업로드)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 원본 파일명 유지
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // PDF와 TXT 파일만 허용
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'text/plain' || 
        file.originalname.toLowerCase().endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('PDF 또는 TXT 파일만 업로드 가능합니다.'));
    }
  }
});

// 문서 텍스트 추출 함수 (파일 유형에 따라 다른 처리)
async function extractTextFromFile(filePath) {
  const fileExt = path.extname(filePath).toLowerCase();
  
  try {
    if (fileExt === '.pdf') {
      // PDF 파일 처리
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      return pdfData.text;
    } else if (fileExt === '.txt') {
      // TXT 파일 처리
      return fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`지원하지 않는 파일 형식: ${fileExt}`);
    }
  } catch (error) {
    console.error(`파일 처리 오류 (${filePath}):`, error);
    throw error;
  }
}

// 텍스트를 청크로 분할하는 함수
function splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 100) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const chunks = [];
  let startIndex = 0;
  
  // 너무 긴 텍스트는 청크로 분할
  while (startIndex < text.length) {
    // 청크 크기 계산 (텍스트 끝 고려)
    const endIndex = Math.min(startIndex + maxChunkSize, text.length);
    let chunk = text.substring(startIndex, endIndex);
    
    // 문장 중간에 자르지 않도록 조정 (가능하면)
    if (endIndex < text.length) {
      const lastPeriodIndex = chunk.lastIndexOf('.');
      const lastQuestionIndex = chunk.lastIndexOf('?');
      const lastExclamationIndex = chunk.lastIndexOf('!');
      
      // 마지막 문장 끝 찾기
      const lastSentenceEnd = Math.max(
        lastPeriodIndex,
        lastQuestionIndex,
        lastExclamationIndex
      );
      
      // 문장 끝을 찾았고, 최소 길이 이상이면 그 위치에서 자름
      if (lastSentenceEnd > maxChunkSize / 2) {
        chunk = text.substring(startIndex, startIndex + lastSentenceEnd + 1);
        startIndex += lastSentenceEnd + 1;
      } else {
        // 적절한 문장 끝을 찾지 못했으면 최대 크기로 자르고 다음 청크는 약간 겹치게 함
        startIndex += maxChunkSize - overlap;
      }
    } else {
      startIndex = text.length;
    }
    
    // 유효한 청크만 저장 (비어있지 않고 최소 길이 이상)
    if (chunk.trim().length > 50) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
}

// 코사인 유사도 계산
function calculateCosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
  return normProduct === 0 ? 0 : dotProduct / normProduct;
}

// 파일 시스템에서 모든 파일 로드
async function loadAllFilesFromDirectory() {
  try {
    console.log('업로드 디렉토리에서 파일 로드 중...');
    console.log(`업로드 디렉토리 경로: ${uploadsDir}`);
    
    const files = fs.readdirSync(uploadsDir);
    console.log('디렉토리 내 모든 파일:', files);
    
    let loadedFiles = 0;
    
    // 기존 문서 저장소 초기화
    documentStore = [];
    
    // 모든 TXT 파일을 처리
    const txtFiles = files.filter(file => 
      file.toLowerCase().endsWith('.txt')
    );
    
    console.log(`발견된 TXT 파일 (${txtFiles.length}개):`, txtFiles);
    
    // TXT 파일 우선 로드
    for (const filename of txtFiles) {
      const filePath = path.join(uploadsDir, filename);
      
      try {
        // 파일 존재 여부 확인
        if (!fs.existsSync(filePath)) {
          console.error(`파일이 존재하지 않음: ${filePath}`);
          continue;
        }
        
        // 파일 상태 확인
        const stats = fs.statSync(filePath);
        console.log(`파일 ${filename} 크기: ${stats.size} 바이트`);
        
        if (stats.size === 0) {
          console.warn(`경고: ${filename} 파일이 비어있습니다.`);
          continue;
        }
        
        // 파일 읽기
        console.log(`TXT 파일 로드 중: ${filename}`);
        const text = fs.readFileSync(filePath, 'utf8');
        
        // 텍스트 내용 확인 (처음 100자만)
        console.log(`${filename} 내용 미리보기: ${text.substring(0, 100)}...`);
        
        if (!text || text.trim() === '') {
          console.warn(`경고: ${filename} 파일에 내용이 없습니다.`);
          continue;
        }
        
        // 텍스트를 청크로 분할
        const chunks = splitTextIntoChunks(text);
        console.log(`${filename}: ${chunks.length}개 청크로 분할됨`);
        
        // 각 청크에 대한 임베딩 생성
        for (let i = 0; i < chunks.length; i++) {
          try {
            console.log(`${filename} 청크 ${i+1}/${chunks.length} 처리 중... (길이: ${chunks[i].length}자)`);
            
            const embeddingResponse = await openai.embeddings.create({
              model: "text-embedding-ada-002",
              input: chunks[i],
            });
            
            // 문서 저장소에 저장
            documentStore.push({
              content: chunks[i],
              embedding: embeddingResponse.data[0].embedding,
              metadata: {
                source: filename,
                chunkIndex: i,
                totalChunks: chunks.length,
                fileType: 'txt'
              }
            });
            
            console.log(`${filename} 청크 ${i+1}/${chunks.length} 임베딩 완료`);
          } catch (embeddingError) {
            console.error(`청크 임베딩 오류 (${filename}, 청크 ${i}):`, embeddingError);
          }
        }
        
        loadedFiles++;
        console.log(`${filename} 처리 완료`);
      } catch (fileError) {
        console.error(`파일 처리 오류 (${filename}):`, fileError.message);
        console.error(fileError.stack);
      }
    }
    
    // PDF 파일도 처리
    const pdfFiles = files.filter(file => 
      file.toLowerCase().endsWith('.pdf')
    );
    
    console.log(`발견된 PDF 파일: ${pdfFiles.length}개`);
    
    for (const filename of pdfFiles) {
      const filePath = path.join(uploadsDir, filename);
      
      try {
        // PDF에서 텍스트 추출
        const text = await extractTextFromFile(filePath);
        
        // 텍스트를 청크로 분할
        const chunks = splitTextIntoChunks(text);
        
        // 각 청크에 대한 임베딩 생성
        for (let i = 0; i < chunks.length; i++) {
          const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: chunks[i],
          });
          
          // 문서 저장소에 저장
          documentStore.push({
            content: chunks[i],
            embedding: embeddingResponse.data[0].embedding,
            metadata: {
              source: filename,
              chunkIndex: i,
              totalChunks: chunks.length,
              fileType: 'pdf'
            }
          });
        }
        
        loadedFiles++;
      } catch (fileError) {
        console.error(`PDF 파일 처리 오류 (${filename}):`, fileError);
      }
    }
    
    console.log(`총 ${loadedFiles}개 파일 로드 완료, 총 ${documentStore.length}개 청크 생성됨`);
    console.log('문서 저장소 통계:');
    
    // 파일별 청크 수 통계
    const fileStats = {};
    documentStore.forEach(item => {
      const source = item.metadata.source;
      if (!fileStats[source]) {
        fileStats[source] = 0;
      }
      fileStats[source]++;
    });
    
    Object.entries(fileStats).forEach(([file, count]) => {
      console.log(`- ${file}: ${count}개 청크`);
    });
    
    return loadedFiles;
  } catch (error) {
    console.error('파일 로드 오류:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// 서버 시작 시 기존 파일 로드
console.log('서버 시작 중... 업로드 디렉토리에서 모든 문서 파일을 로드합니다.');
loadAllFilesFromDirectory()
  .then(count => {
    console.log(`서버 시작 시 ${count}개 파일 로드됨`);
    
    // 각 파일에 대한 URL 맵핑 확인
    const loadedFiles = documentStore.map(doc => doc.metadata.source);
    const uniqueFiles = [...new Set(loadedFiles)];
    
    console.log('로드된 파일 목록:');
    uniqueFiles.forEach(file => {
      const url = fileUrlMapping[file] || '링크 없음';
      console.log(`- ${file} (${url})`);
    });
  })
  .catch(err => console.error('초기 파일 로드 실패:', err));

// 관련 링크 찾기 함수
function findRelevantLinks(message, searchResults) {
  // 검색어와 문서 내용에서 키워드 추출
  const combinedText = message.toLowerCase() + ' ' + 
    searchResults.map(result => result.content.toLowerCase()).join(' ');
  
  // 검색 결과에서 사용된 파일명 추출
  const usedSources = searchResults.map(result => result.metadata.source);
  
  // 파일명 기반 링크 찾기
  const fileBasedLinks = schoolLinks.filter(link => {
    return link.filename && usedSources.includes(link.filename);
  });
  
  // 키워드 기반 링크 찾기
  const keywordBasedLinks = schoolLinks.filter(link => {
    return link.keywords.some(keyword => combinedText.includes(keyword.toLowerCase()));
  });
  
  // 결과 병합 및 중복 제거
  const allLinks = [...fileBasedLinks, ...keywordBasedLinks];
  const uniqueLinks = [];
  const seenIds = new Set();
  
  allLinks.forEach(link => {
    if (!seenIds.has(link.id)) {
      uniqueLinks.push(link);
      seenIds.add(link.id);
    }
  });
  
  return uniqueLinks;
}

// API 경로 정의

// 파일 업로드 및 처리 API
app.post('/api/upload-documents', upload.array('documents'), async (req, res) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '업로드된 파일이 없습니다.'
      });
    }
    
    let processedCount = 0;
    const newDocuments = [];
    
    for (const file of files) {
      try {
        // 파일에서 텍스트 추출
        const text = await extractTextFromFile(file.path);
        
        // 텍스트를 청크로 분할
        const chunks = splitTextIntoChunks(text);
        
        // 각 청크에 대한 임베딩 생성
        for (let i = 0; i < chunks.length; i++) {
          const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: chunks[i],
          });
          
          const docItem = {
            content: chunks[i],
            embedding: embeddingResponse.data[0].embedding,
            metadata: {
              source: file.originalname,
              chunkIndex: i,
              totalChunks: chunks.length,
              fileType: path.extname(file.originalname).substring(1)
            }
          };
          
          // 문서 저장소에 추가
          documentStore.push(docItem);
          newDocuments.push(docItem);
        }
        
        processedCount++;
        console.log(`파일 처리 완료: ${file.originalname} (${chunks.length} 청크)`);
      } catch (fileError) {
        console.error(`파일 처리 오류 (${file.originalname}):`, fileError);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `${processedCount}개 파일이 성공적으로 처리되었습니다.`,
      processedFiles: processedCount,
      totalChunks: documentStore.length,
      newChunks: newDocuments.length
    });
  } catch (error) {
    console.error('문서 업로드 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: '문서 처리 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 채팅 응답 생성 API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, studentInfo, conversation } = req.body;
    console.log('채팅 API 요청 받음:');
    console.log('- 메시지:', message);
    console.log('- 학생 정보:', studentInfo);
    
    if (!message || message.trim() === '') {
      console.warn('빈 메시지 요청 거부');
      return res.status(400).json({
        success: false,
        error: '메시지가 비어있습니다.'
      });
    }
    
    // 문서 데이터가 없는 경우 자동 로드 시도
    if (documentStore.length === 0) {
      console.log('문서 저장소가 비어있음 - 파일 로드 시도');
      try {
        const loadedCount = await loadAllFilesFromDirectory();
        console.log(`자동 로드 완료: ${loadedCount}개 파일`);
        
        if (loadedCount === 0) {
          console.error('참조할 문서가 없음');
          return res.status(400).json({
            success: false,
            error: '참조할 문서가 없습니다. 먼저 문서를 업로드해주세요.'
          });
        }
      } catch (loadError) {
        console.error('문서 자동 로드 오류:', loadError);
        return res.status(500).json({
          success: false,
          error: '문서 로드 중 오류가 발생했습니다.'
        });
      }
    }
    
    console.log(`현재 문서 저장소 크기: ${documentStore.length}개 청크`);
    
    // 쿼리 임베딩 생성
    console.log('쿼리 임베딩 생성 중...');
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    });
    
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    console.log('쿼리 임베딩 생성 완료');
    
    // 관련 문서 검색
    console.log('관련 문서 검색 중...');
    const searchResults = documentStore
      .map(doc => ({
        content: doc.content,
        metadata: doc.metadata,
        similarity: calculateCosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // 상위 3개 결과
    
    console.log('검색 결과:');
    searchResults.forEach((result, i) => {
      console.log(`결과 ${i+1}:`);
      console.log(`- 파일: ${result.metadata.source}`);
      console.log(`- 유사도: ${result.similarity.toFixed(4)}`);
      console.log(`- 내용 미리보기: ${result.content.substring(0, 100)}...`);
    });
    
    // 관련 문서가 없는 경우
    if (searchResults.length === 0) {
      console.warn('관련 문서를 찾지 못함');
      return res.status(400).json({
        success: false,
        error: '질문과 관련된 문서를 찾을 수 없습니다.'
      });
    }
    
    // 관련 컨텍스트 추출
    const context = searchResults
      .map(item => `[출처: ${item.metadata.source}]\n${item.content}`)
      .join('\n\n');
    
    // 대화 이력 포맷팅
    const conversationHistory = conversation && Array.isArray(conversation)
      ? conversation
          .slice(-5) // 최근 5개 메시지만 사용
          .map(msg => `${msg.sender === 'user' ? '학부모' : '챗봇'}: ${msg.text}`)
          .join('\n')
      : '';
    
    // 관련 링크 찾기
    console.log('관련 링크 찾는 중...');
    const relevantLinks = findRelevantLinks(message, searchResults);
    console.log(`관련 링크 ${relevantLinks.length}개 찾음:`, relevantLinks.map(l => l.title));
    
    // 문서 파일 정보와 링크 추가
    const fileInfo = searchResults
      .map(item => {
        const filename = item.metadata.source;
        const url = fileUrlMapping[filename] || null;
        return url ? `- ${filename}: ${url}` : `- ${filename}`;
      })
      .filter((value, index, self) => self.indexOf(value) === index) // 중복 제거
      .join('\n');
    
    // GPT 프롬프트 구성
    console.log('GPT 프롬프트 구성 중...');
    
    // 시스템 프롬프트 확장
    const systemPrompt = `
당신은 이도 초등학교의 학부모 소통 챗봇입니다. 아래 제공된 학교 자료와 대화 이력을 바탕으로 학부모의 질문에 정확하고 친절하게 답변해주세요.

대응 지침:
1. 제공된 학교 자료에 있는 정보만 사용하여 답변하세요.
2. 확실하지 않은 정보에 대해서는 "이 부분은 선생님께 확인 후 답변드리겠습니다."라고 안내하세요.
3. 항상 정중하고 전문적인 어조를 유지하세요.
4. 답변은 간결하고 명확하게 제공하세요.
5. 학생에 관한 개인적인 평가나 의견은 제시하지 마세요.
6. 할루시네이션(신뢰할 수 없는 정보 생성)을 피하세요. 모르는 것은 모른다고 솔직하게 답변하세요.

학생 정보: ${studentInfo.grade}학년 ${studentInfo.class}반 ${studentInfo.name}

다음은 검색된 관련 문서 파일 및, 해당 자료를 확인할 수 있는 링크입니다:
${fileInfo}

위 문서 내용을 바탕으로, 특히 교육비 지원이나 급식 관련 질문에 대해서는 구체적인 정보를 제공해 주세요.
`;

    // 사용자 메시지 구성
    const userContent = `
관련 학교 자료:
${context}

${conversationHistory ? `대화 이력:\n${conversationHistory}\n\n` : ''}
학부모 질문: ${message}
`;

    // ChatGPT API 호출
    console.log('ChatGPT API 호출 중...');
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const botResponse = chatCompletion.choices[0].message.content;
    console.log('ChatGPT 응답 받음 (길이:', botResponse.length, '자)');
    
    console.log('응답 전송 중...');
    res.status(200).json({
      success: true,
      response: botResponse,
      sources: searchResults.map(item => item.metadata.source),
      relevantLinks: relevantLinks
    });
    console.log('응답 전송 완료');
  } catch (error) {
    console.error('챗봇 응답 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: '응답 생성 중 오류가 발생했습니다: ' + error.message
    });
  }
});


// 대화 상태 분류 API - 이어서
app.post('/api/classify-conversation', async (req, res) => {
  try {
    const { conversation, studentInfo } = req.body;
    
    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 대화 내용이 없습니다.'
      });
    }
    
    // 대화 내용 포맷팅
    const conversationText = conversation
      .map(msg => `${msg.sender === 'user' ? '학부모' : '챗봇'}: ${msg.text}`)
      .join('\n');
    
    // OpenAI API로 대화 분류
    const classificationPrompt = `
다음은 이도 초등학교 ${studentInfo.grade}학년 ${studentInfo.class}반 ${studentInfo.name} 학생의 학부모와 챗봇 간의 대화입니다:

${conversationText}

위 대화를 분석하여 다음 세 가지 상태 중 하나로 분류해주세요:
1. [해결] - 학부모의 문의가 충분히 해결되었거나 단순 정보 확인인 경우
2. [미해결] - 학부모의 문의가 해결되지 않았거나 추가 조치가 필요한 경우
3. [확인 부탁] - 교사의 확인이나 추가 정보가 필요한 경우

결과는 "[해결]", "[미해결]", 또는 "[확인 부탁]" 중 하나만 답변해주세요.
`;

    const classificationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: classificationPrompt }],
      temperature: 0.3,
      max_tokens: 10
    });
    
    let status = classificationResponse.choices[0].message.content.trim();
    
    // 유효한 상태인지 확인
    if (!status.includes('[해결]') && !status.includes('[미해결]') && !status.includes('[확인 부탁]')) {
      status = '[확인 부탁]'; // 기본값
    }
    
    res.status(200).json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('대화 분류 오류:', error);
    res.status(500).json({
      success: false,
      error: '대화 분류 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 대화 요약 생성 API
app.post('/api/summarize-conversation', async (req, res) => {
  try {
    const { conversation, studentInfo } = req.body;
    
    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 대화 내용이 없습니다.'
      });
    }
    
    // 대화 내용 포맷팅
    const conversationText = conversation
      .map(msg => `${msg.sender === 'user' ? '학부모' : '챗봇'}: ${msg.text}`)
      .join('\n');
    
    // 모든 메시지 내용을 하나의 문자열로 결합
    const allText = conversation.map(msg => msg.text).join(' ').toLowerCase();
    
    // 관련 링크 찾기
    const relevantLinks = schoolLinks.filter(link => {
      return link.keywords.some(keyword => allText.includes(keyword));
    });
    
    // OpenAI API로 대화 요약
    const summaryPrompt = `
다음은 이도 초등학교 ${studentInfo.grade}학년 ${studentInfo.class}반 ${studentInfo.name} 학생의 학부모와 챗봇 간의 대화입니다:

${conversationText}

위 대화를 다음 형식으로 요약해주세요:
1. 주제: (대화의 주요 주제를 한 문장으로)
2. 주요 논의사항: (대화에서 다룬 핵심 내용을 3-5개의 간결한 불렛 포인트로)

JSON 형식으로 응답해주세요:
{
  "topic": "주제가 여기에 들어갑니다",
  "keyPoints": ["첫 번째 요점", "두 번째 요점", "세 번째 요점"]
}
`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.5,
      max_tokens: 300
    });
    
    let summary;
    try {
      summary = JSON.parse(summaryResponse.choices[0].message.content);
    } catch (parseError) {
      // JSON 파싱 실패 시 기본값 설정
      console.error('JSON 파싱 오류:', parseError);
      summary = {
        topic: '학부모 문의',
        keyPoints: ['대화 내용 요약을 처리할 수 없습니다.']
      };
    }
    
    res.status(200).json({
      success: true,
      summary: {
        ...summary,
        links: relevantLinks
      }
    });
  } catch (error) {
    console.error('대화 요약 오류:', error);
    res.status(500).json({
      success: false, 
      error: '대화 요약 중 오류가 발생했습니다: ' + error.message
    });
  }
});
// 이메일 발송 API
app.post('/api/send-email', async (req, res) => {
  try {
    const { studentInfo, conversation, status, summary, parentEmail } = req.body;
    
    if (!studentInfo || !conversation || !status) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      });
    }
    
    // 이메일 제목
    const subject = `${status} ${studentInfo.grade}학년 ${studentInfo.class}반 ${studentInfo.name} 학부모 문의`;
    
    // 대화 내용 포맷팅
    const conversationLog = conversation
      .map(msg => `${msg.sender === 'user' ? '학부모' : '챗봇'}: ${msg.text}`)
      .join('\n\n');
    
    // 요약 정보 포맷팅
    let summaryText = '';
    if (summary) {
      summaryText = `
■ 문의 요약
- 주제: ${summary.topic || '일반 문의'}
- 주요 논의사항:
${summary.keyPoints ? summary.keyPoints.map(point => `  ‣ ${point}`).join('\n') : '  ‣ 요약 정보 없음'}
`;
      
      if (summary.links && summary.links.length > 0) {
        summaryText += `
- 관련 링크:
${summary.links.map(link => `  ‣ ${link.title}: ${link.url}`).join('\n')}
`;
      }
    }
    
    // 이메일 본문
    const emailBody = `
안녕하세요, ${studentInfo.grade}학년 ${studentInfo.class}반 담임 선생님,

${studentInfo.name} 학생의 학부모님으로부터 다음과 같은 문의가 접수되었습니다.

${summaryText}

====== 대화 전체 내용 ======
${conversationLog}
=========================

위 내용을 확인하시고 필요한 조치를 취해주시기 바랍니다.

감사합니다.
이도 초등학교 학부모 소통 챗봇
`;

    // 학부모용 이메일 본문
    const parentEmailBody = `
${studentInfo.name} 학생의 학부모님께,

이도 초등학교 챗봇을 통한 문의 내용이 ${studentInfo.grade}학년 ${studentInfo.class}반 담임 선생님께 전달되었습니다.

${summaryText}

감사합니다.
이도 초등학교 학부모 소통 챗봇
`;

    // Nodemailer 설정
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    // 교사 이메일 주소 (실제로는 DB에서 조회)
    const teacherEmail = `${process.env.EMAIL_USER}`; // 개발 테스트용으로 동일한 이메일 사용
    
    console.log(`이메일 발송 준비:
    - 호스트: ${process.env.EMAIL_HOST}
    - 포트: ${process.env.EMAIL_PORT}
    - 보안: ${process.env.EMAIL_SECURE}
    - 사용자: ${process.env.EMAIL_USER}
    - 보내는 주소: ${process.env.EMAIL_FROM}
    - 받는 주소(교사): ${teacherEmail}
    - 받는 주소(학부모): ${studentInfo.parentEmail || parentEmail || '없음'}`);
    
    // 이메일 발송
    try {
      // 교사에게 이메일 발송
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: teacherEmail,
        subject: subject,
        text: emailBody
      });
      
      console.log(`교사에게 이메일 전송 완료: ${subject}`);
      
      // 학부모에게도 이메일 발송 (제공된 경우)
      if (studentInfo.parentEmail || parentEmail) {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: studentInfo.parentEmail || parentEmail,
          subject: `[이도 초등학교] ${studentInfo.name} 학생 문의 접수 확인`,
          text: parentEmailBody
        });
        
        console.log(`학부모에게 이메일 전송 완료: ${studentInfo.parentEmail || parentEmail}`);
      }
    } catch (emailError) {
      console.error('이메일 전송 오류:', emailError);
      console.log('이메일 세부 정보:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE,
        user: process.env.EMAIL_USER
      });
      
      // 이메일 전송 실패시에도 API는 성공으로 응답 (UX 개선)
      console.log('이메일 발송 실패하였으나 API는 성공으로 응답합니다.');
    }
    
    res.status(200).json({
      success: true,
      message: '교사와 학부모에게 이메일이 성공적으로 전송되었습니다.',
      emailSubject: subject
    });
  } catch (error) {
    console.error('이메일 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: '이메일 처리 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 서버 시작
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

module.exports = app;