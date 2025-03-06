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
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

// Express 앱 초기화
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OpenAI API 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 폴더 구조 설정
const uploadsDir = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// 필요한 디렉토리 생성
[uploadsDir, DATA_DIR, CONVERSATIONS_DIR, IMAGES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`디렉토리 생성됨: ${dir}`);
  }
});

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
    url: 'https://school.jje.go.kr/ido/schl/sv/schdulView/schdulCalendarView.do?mi=106430&schdlKndSn=106430',
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
  '제59회 도민체육대회 참가요강.txt': 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&nttSn=40511420',
  '학사일정.txt': 'https://school.jje.go.kr/ido/sv/schdulView/selectSchdulCalendar.do?mi=106454',
  '3월 급식.txt': 'https://school.jje.go.kr/ido/ad/fm/foodmenu/selectFoodMenuView.do?mi=106449',
  
  // PDF 파일 추가
  '2025학년도 교육급여 및 교육비 지원신청 안내.pdf': 'https://www.jejusi.go.kr/news/areaNews.do?mode=detail&notice_id=1d48a6ea5ec94963883916e35ce6c442&currentPageNo=19',
  '2025학년도 다자녀 가정 교육비 지원 신청 안내.pdf': 'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1126&ccfNo=4&cciNo=2&cnpClsNo=1',
  '제59회 도민체육대회 참가요강.pdf': 'https://school.jje.go.kr/ido/na/ntt/selectNttInfo.do?mi=106429&nttSn=40511420'
};

// Multer 설정 수정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 이미지는 IMAGES_DIR에 저장
    cb(null, IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `image_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
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
<<<<<<< HEAD
        //test
        // for (let i = 0; i < chunks.length; i++) {
        //   try {
        //     console.log(`${filename} 청크 ${i+1}/${chunks.length} 처리 중... (길이: ${chunks[i].length}자)`);
=======
        for (let i = 0; i < chunks.length; i++) {
          try {
            console.log(`${filename} 청크 ${i+1}/${chunks.length} 처리 중... (길이: ${chunks[i].length}자)`);
>>>>>>> mmvp_back
            
        //     const embeddingResponse = await openai.embeddings.create({
        //       model: "text-embedding-ada-002",
        //       input: chunks[i],
        //     });
            
        //     // 문서 저장소에 저장
        //     documentStore.push({
        //       content: chunks[i],
        //       embedding: embeddingResponse.data[0].embedding,
        //       metadata: {
        //         source: filename,
        //         chunkIndex: i,
        //         totalChunks: chunks.length,
        //         fileType: 'txt'
        //       }
        //     });
            
        //     console.log(`${filename} 청크 ${i+1}/${chunks.length} 임베딩 완료`);
        //   } catch (embeddingError) {
        //     console.error(`청크 임베딩 오류 (${filename}, 청크 ${i}):`, embeddingError);
        //   }
        // }
        
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

// 언어 감지 함수
const detectLanguage = async (text) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a language detector. Respond with only the language code (ko, en, ja, zh) of the input text."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0,
      max_tokens: 2
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('언어 감지 오류:', error);
    return 'ko'; // 기본값으로 한국어 반환
  }
};

<<<<<<< HEAD
// API 경로 정의
// 채팅 응답 생성 API
/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Generate chatbot response based on user query
 *     description: Receives a user message, searches related documents, processes the conversation history, and generates a chatbot response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: The user's input message
 *               studentInfo:
 *                 type: object
 *                 properties:
 *                   grade:
 *                     type: integer
 *                   class:
 *                     type: integer
 *                   name:
 *                     type: string
 *                 description: Student information
 *               conversation:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sender:
 *                       type: string
 *                     text:
 *                       type: string
 *                 description: The conversation history with previous chatbot responses
 *     responses:
 *       200:
 *         description: Successful chatbot response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 response:
 *                   type: string
 *                   description: The chatbot-generated response
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of sources used for generating the response
 *                 relevantLinks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       url:
 *                         type: string
 *                   description: Relevant links related to the user's query
 *       400:
 *         description: Bad request due to missing or invalid data
 *       500:
 *         description: Internal server error
 */
=======
// 챗봇 응답 생성 API 수정
>>>>>>> mmvp_back
app.post('/api/chat', async (req, res) => {
  try {
    const { message, studentInfo, conversation } = req.body;
    console.log('채팅 API 요청 받음:');
    console.log('- 메시지:', message);
    console.log('- 학생 정보:', studentInfo);
    
    // 입력 언어 감지 추가
    const detectedLanguage = await detectLanguage(message);
    console.log('감지된 언어:', detectedLanguage);
    
    // 여기에 아래 코드 추가
    console.log('- 이전 대화 개수:', conversation ? conversation.length : 0);
    
    // 대화 내용 검증
    if (conversation && Array.isArray(conversation)) {
      const userMessages = conversation.filter(msg => msg.sender === 'user');
      const botMessages = conversation.filter(msg => msg.sender === 'bot');
      console.log('- 사용자 메시지 수:', userMessages.length);
      console.log('- 챗봇 메시지 수:', botMessages.length);
    }
    
    if (!message || message.trim() === '') {
      console.warn('빈 메시지 요청 거부');
      return res.status(400).json({
        success: false,
        error: '메시지가 비어있습니다.'
      });
    }

    // 문서 데이터 확인 및 로드
    if (documentStore.length === 0) {
      await loadAllFilesFromDirectory();
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
    
    // 대화 이력 포맷팅 - 직접 검증하여 안정적으로 구성
    let conversationHistory = '';
    
    if (conversation && Array.isArray(conversation)) {
      try {
        // 최근 5개 메시지만 사용
        const recentMessages = conversation.slice(-5);
        
        conversationHistory = recentMessages
          .map(msg => {
            // 필드 검증 후 안전하게 구성
            const sender = msg.sender === 'user' ? '학부모' : '챗봇';
            const text = msg.text || '(내용 없음)';
            return `${sender}: ${text}`;
          })
          .join('\n');
        
        console.log('대화 이력 구성 완료, 길이:', conversationHistory.length);
      } catch (historyError) {
        console.error('대화 이력 처리 오류:', historyError);
        conversationHistory = '';
      }
    }
    
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
    
    // GPT 프롬프트 구성 - 민지 선생님 정체성 적용
    console.log('GPT 프롬프트 구성 중...');
    
    // 시스템 프롬프트 확장
    // 개선된 GPT 프롬프트 - 오해 해소 및 감정 진정 지침 추가
const systemPrompt = `
당신은 이도 초등학교의 '민지 선생님'으로, 학부모 소통 챗봇입니다. 아래 제공된 학교 자료와 대화 이력을 바탕으로 학부모의 질문에 정확하고 친절하게 답변해주세요.

안녕하세요, 이도 초등학교 민지 선생님입니다. 학부모님의 다양한 배경과 상황을 존중하며 최선을 다해 도와드리겠습니다. 

대응 지침:
1. 자신을 '민지 선생님'으로 소개하고, 학부모님께 정중하게 인사해 주세요.
2. 제공된 학교 자료에 있는 정보만 사용하여 답변하세요.
3. 확실하지 않은 정보에 대해서는 "이 부분은 담당 선생님께 확인 후 답변드리겠습니다."라고 안내하세요.
4. 항상 정중하고 전문적인 어조를 유지하며, "안녕하세요~" 등 친근한 인사말을 사용해도 좋습니다.
5. 답변은 간결하고 명확하게 제공하세요.
6. 학생에 관한 개인적인 평가나 의견은 제시하지 마세요.
7. 할루시네이션(신뢰할 수 없는 정보 생성)을 피하세요. 모르는 것은 모른다고 솔직하게 답변하세요.
8. 욕설이나 비속어를 사용하는 감정적인 학부모가 있다면 공감하며 진정시키고자 노력하세요.
9. 질문할 때 용어 등에서 오해가 있지 않은지 살피고 정정하여 답해주세요. (예: "방학식 중식 제공"의 중식은 중국 음식이 아닌 점심 식사를 뜻합니다.)
10. 학부모의 질문에 교육 용어나 학교 관련 용어가 잘못 사용된 경우, 부드럽게 정확한 의미를 설명해 주세요.

학부모 응대 원칙:
1. 학부모의 감정에 공감하고 우려사항을 충분히 경청하는 자세를 보여주세요.
2. 감정적인 표현이 있더라도 먼저 공감을 표현한 후, 정보를 제공하세요.
3. "이해합니다", "걱정이 크실 것 같습니다", "말씀해주셔서 감사합니다"와 같은 공감 표현을 적절히 사용하세요.
4. 학교와 교사는 학생을 위해 최선을 다하고 있다는 메시지를 전달하세요.

민원 처리 기본 원칙:
1. 모든 학부모 문의는 신속·공정·친절·적법하게 처리하는 것을 원칙으로 합니다.
2. 학교 내에서 해결이 어려운 문의는 담당 교사나 관리자에게 전달할 것을 안내합니다.
3. 급식의 알레르기 정보는 ①난류(가금류), ②우유, ③메밀, ④땅콩, ⑤대두, ⑥밀, ⑦고등어, ⑧게, ⑨새우, ⑩돼지고기, ⑪복숭아, ⑫토마토로 표시됩니다.

부적절한 표현 대응:
1. 학부모가 폭언이나 협박, 부적절한 요구를 할 경우, 정중하게 대화 방식의 조정을 요청하세요.
2. 예: "원활한 소통을 위해 서로 존중하는 대화가 필요합니다. 어떤 부분이 걱정되시는지 차분히 말씀해주시면 최선을 다해 도와드리겠습니다."
3. 심각한 폭언이나 협박의 경우: "이러한 대화는 교육활동 침해에 해당할 수 있습니다. 차분한 대화로 문제를 해결해 나가길 제안드립니다."

다양성 존중 대응 지침:

1. 다문화 가정 대응 원칙
- 언어적 장벽을 고려한 소통(언어를 감지하여 해당 언어로 번역된 응답 재제공)
- 필요시 통역 서비스 안내
- 문화적 차이에 대한 존중과 이해
- 다국어 자료 제공 고려

2. 맞벌이 가정 대응 원칙
- 유연한 상담 시간 제공 (이메일, 문자, 온라인 상담)
- 신속하고 간결한 정보 전달
- 야간/주말 상담 옵션 마련
- 근무 중인 학부모를 위한 비대면 소통 채널 확보

3. 한부모/조손 가정 대응 원칙
- 추가 교육 지원 정보 적극 안내
- 학생의 정서적 지원에 대한 세심한 접근
- 학교 내 추가 지원 프로그램 정보 제공
- 개인정보 보호와 존엄성 존중

4. 장애 가정 대응 원칙
- 접근성을 고려한 의사소통 
- 개별화된 맞춤 지원 정보 제공
- 학생의 특수한 요구 존중
- 특수교육 지원 관련 정보 안내

5. 일반 대응 원칙 확장
- 고정관념과 편견 없는 중립적 언어 사용
- 학부모 개인의 고유한 상황 인정
- 개인정보 보호와 프라이버시 존중
- 감정에 공감하고 적극적으로 경청

오늘 날짜: 2024년 3월 7일

공식 소통 채널 안내:
1. 중요한 개인적 문의는 학교 공식 연락처나 담임 교사 면담을 통해 논의할 것을 권장합니다.
2. 교사의 개인 연락처를 요청하는 경우, 학교의 공식 연락 채널을 안내해 주세요.

용어 설명 및 오해 해소:
- "방학식": 방학을 시작하기 전 마지막 등교일에 진행하는 행사입니다.
- "중식": 점심 급식을 의미합니다 (중국 음식이 아님).
- "귀가 지도": 학생들이 안전하게 귀가할 수 있도록 지도하는 것을 의미합니다.
- "교육급여": 저소득층 학생을 위한 정부 지원금입니다.
- "방과후 학교": 정규 수업 이후 학교에서 진행되는 다양한 프로그램을 의미합니다.

학생 정보: ${studentInfo.grade}학년 ${studentInfo.class}반 ${studentInfo.name}

다음은 검색된 관련 문서 파일 및, 해당 자료를 확인할 수 있는 링크입니다:
${fileInfo}

위 문서 내용을 바탕으로, 특히 교육비 지원이나 급식 관련 질문에 대해서는 구체적인 정보를 제공해 주세요.

관련 링크가 있는 경우에만 링크를 제공하고, 없는 경우 링크는 언급하지 마세요.

Please respond in ${detectedLanguage} language.
`;

    // 사용자 메시지 구성
    const userContent = `
관련 학교 자료:
${context}

${conversationHistory ? `대화 이력:\n${conversationHistory}\n\n` : ''}
학부모 질문: ${message}
`;

<<<<<<< HEAD
      // 챗봇 응답 생성 부분 수정
=======
    // 챗봇 응답 생성 부분 수정
>>>>>>> mmvp_back
    if (detectedLanguage !== 'ko') {
      // 한국어 응답
      const koreanResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversation.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      // 외국어 응답 (간단한 번역)
      const foreignResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are a translator. Provide a brief and concise translation of the following response in ${detectedLanguage} language.` 
          },
          { role: "user", content: koreanResponse.choices[0].message.content }
        ],
        temperature: 0.7,
        max_tokens: 250  // 번역은 더 짧게
      });

      botResponse = `${koreanResponse.choices[0].message.content}\n\n---\n${foreignResponse.choices[0].message.content}`;
    } else {
// ChatGPT API 호출 (다국어 처리 포함)
console.log('ChatGPT API 호출 중...');

let chatCompletion;

if (language === 'ko') {
  chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...conversation.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content  // ⭐ 반드시 추가 필요
      }))
    ],
    temperature: 0.7,
    max_tokens: 500
  });
} else {
  chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: 0.7,
    max_tokens: 500
  });
}

const botResponse = chatCompletion.choices[0].message.content;
console.log('응답 전송 중...');

  }
=======
      // 한국어인 경우 기존 로직 유지
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversation.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })),
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      
      botResponse = chatCompletion.choices[0].message.content;
    }

    // 응답 반환
>>>>>>> mmvp_back
    res.status(200).json({
      success: true,
      response: botResponse,
      sources: searchResults.map(item => item.metadata.source),
      relevantLinks: relevantLinks
    });

  } catch (error) {
    console.error('챗봇 응답 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: '응답 생성 중 오류가 발생했습니다: ' + error.message
    });
  }
});

//대화 요약 생성 API
app.post('/api/summarize-conversation', async (req, res) => {
  try {
    const { conversation, studentInfo } = req.body;
    
    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({
        success: false,
        error: '유효한 대화 내용이 없습니다.'
      });
    }
    
    // 대화 내용 포맷팅
    const conversationText = conversation
      .map(msg => `${msg.sender === 'user' ? '학부모' : '챗봇'}: ${msg.text}`)
      .join('\n');
    
    // OpenAI API로 대화 요약
    const summaryPrompt = `
다음은 이도 초등학교 ${studentInfo.grade}학년 ${studentInfo.class}반 ${studentInfo.name} 학생의 학부모와 챗봇 간의 대화입니다:

${conversationText}

위 대화를 분석하여 다음 정보를 제공해주세요:
1. 주제: 이 대화의 주요 주제는 무엇인가요?
2. 주요 논의사항: 중요한 포인트 3-5개를 간결한 문장으로 정리해주세요.

JSON 형식으로 응답해주세요:
{
  "topic": "주제",
  "keyPoints": ["논의사항1", "논의사항2", "논의사항3"]
}
`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.6,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });
    
    // JSON 응답 파싱
    const summaryContent = summaryResponse.choices[0].message.content;
    const summary = JSON.parse(summaryContent);
    
    // 관련 링크 추가
    const relevantLinks = [];
    if (conversation && conversation.length > 0) {
      // 모든 메시지에서 링크 수집
      conversation.forEach(msg => {
        if (msg.links && Array.isArray(msg.links)) {
          msg.links.forEach(link => {
            if (!relevantLinks.some(l => l.url === link.url)) {
              relevantLinks.push(link);
            }
          });
        }
      });
    }
    
    // 최종 요약에 링크 추가
    summary.links = relevantLinks;
    
    res.status(200).json({
      success: true,
      summary: summary
    });
  } catch (error) {
    console.error('대화 요약 오류:', error);
    res.status(500).json({
      success: false,
      error: '대화 요약 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 필요한 모듈 추가
//const fs = require('fs');
//const path = require('path');

// 대화 내용을 MD 파일로 저장하는 함수
const saveConversationToMD = async (studentInfo, conversation, status, requestType) => {
  try {
    console.log('마크다운 저장 시작...');
    
    // 타임스탬프와 기본 파일명 형식 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `${studentInfo.grade}학년_${studentInfo.class}반_${studentInfo.name}_${timestamp}`;
    
    // 마크다운 파일명 및 경로
    const mdFileName = `${baseFileName}.md`;
    const mdFilePath = path.join(CONVERSATIONS_DIR, mdFileName);

    // 마크다운 내용 생성
    let mdContent = `# 학부모 상담 기록\n\n`;
    mdContent += `## 학생 정보\n\n`;
    mdContent += `- 학년/반: ${studentInfo.grade}학년 ${studentInfo.class}반\n`;
    mdContent += `- 학생 이름: ${studentInfo.name}\n`;
    mdContent += `- 수신인 이메일: ${studentInfo.parentEmail || '정보 없음'}\n\n`;
    
    mdContent += `## 상담 정보\n\n`;
    mdContent += `- 상담 일시: ${new Date().toLocaleString('ko-KR')}\n`;
    mdContent += `- 상담 상태: ${status || '정보 없음'}\n`;
    mdContent += `- 요청 유형: ${requestType || '정보 없음'}\n\n`;
    
    mdContent += `## 대화 내용\n\n`;
    
    // 이미지 저장 및 마크다운에 이미지 링크 추가
    const savedImages = [];
    for (const [msgIndex, msg] of conversation.entries()) {
      // 발신자 이모지와 역할 설정
      const sender = msg.sender === 'user' ? '👨‍👩‍👧‍👦 학부모님' : '👩‍🏫 민지 선생님';
      
      // 각 메시지 추가 (빈 메시지 제외)
      if (msg.text && msg.text.trim()) {
        mdContent += `### ${sender} (${msgIndex + 1})\n\n${msg.text.trim()}\n\n`;
      }
      
      // 이미지 처리
      if (msg.images && Array.isArray(msg.images)) {
        for (const [imgIndex, image] of msg.images.entries()) {
          const imgFileName = `${baseFileName}_img${String(msgIndex+1).padStart(2, '0')}${String(imgIndex+1).padStart(2, '0')}${getImageExtension(image)}`;
          const imgFilePath = path.join(IMAGES_DIR, imgFileName);
          
          try {
            if (image.data) {
              const base64Data = image.data.replace(/^data:image\/\w+;base64,/, '');
              await fs.promises.writeFile(imgFilePath, Buffer.from(base64Data, 'base64'));
              savedImages.push({ path: imgFilePath, name: imgFileName });
              mdContent += `![이미지 ${msgIndex+1}-${imgIndex+1}](../images/${imgFileName})\n\n`;
            }
          } catch (imgError) {
            console.error(`이미지 저장 실패 (${imgFileName}):`, imgError);
          }
        }
      }
    }

    // 마크다운 파일 저장
    await fs.promises.writeFile(mdFilePath, mdContent, 'utf8');

    return {
      filePath: mdFilePath,
      fileName: mdFileName,
      savedImages: savedImages
    };
  } catch (error) {
    console.error('마크다운 저장 오류:', error);
    throw error;
  }
};

// 이미지 확장자 가져오기 함수
function getImageExtension(image) {
  if (image.data) {
    const match = image.data.match(/^data:image\/(\w+);/);
    return match ? `.${match[1]}` : '.jpg';
  }
  return '.jpg';
}

// 이미지 저장 함수 수정
const saveImage = async (imageData, fileName) => {
  try {
    if (!imageData) {
      throw new Error('이미지 데이터가 없습니다.');
    }

    // IMAGES_DIR이 존재하는지 확인하고 없으면 생성
    if (!fs.existsSync(IMAGES_DIR)) {
      await fs.promises.mkdir(IMAGES_DIR, { recursive: true });
    }

    const filePath = path.join(IMAGES_DIR, fileName);
    
    // Base64 이미지 데이터 처리
    if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
      const matches = imageData.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        await fs.promises.writeFile(filePath, buffer);
        console.log('이미지 저장 성공:', filePath);
        return filePath;
      }
    }

    throw new Error('지원되지 않는 이미지 형식입니다.');
  } catch (error) {
    console.error('이미지 저장 오류:', error);
    throw error;
  }
};

// 이메일 발송 API 수정
app.post('/api/send-email', upload.array('images'), async (req, res) => {
  try {
    console.log('이메일 전송 API 호출됨');
    
    const { studentInfo, conversation, status, requestType, summary, parentEmail } = req.body;
    const parsedStudentInfo = JSON.parse(studentInfo);
    const parsedConversation = JSON.parse(conversation);
    const parsedSummary = JSON.parse(summary);
    
    // 이메일 본문 생성
    const emailBody = `
${parsedStudentInfo.grade}학년 ${parsedStudentInfo.class}반 ${parsedStudentInfo.name} 학생 관련 문의입니다.

상태: ${status}
요청 유형: ${requestType}

주제: ${parsedSummary.topic}

주요 논의사항:
${parsedSummary.keyPoints.map(point => `- ${point}`).join('\n')}

대화 내용:
${parsedConversation.map(msg => 
  `${msg.sender === 'user' ? '학부모' : '챗봇'}: ${msg.text}`
).join('\n\n')}
`;
    
    const attachments = [];
    
    // 이미지 처리 함수
    const processImage = async (imageData, originalName) => {
      try {
        let imageBuffer;
        
        if (imageData.startsWith('data:image')) {
          const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          imageBuffer = Buffer.from(imageData, 'base64');
        }

        // 파일 확장자 결정
        const mimeType = imageData.startsWith('data:image') 
          ? imageData.split(';')[0].split('/')[1]
          : mime.getExtension(originalName) || 'jpg';
        
        // UUID를 사용한 고유한 파일명 생성
        const fileName = `${uuidv4()}.${mimeType}`;
        const filePath = path.join(IMAGES_DIR, fileName);

        // sharp를 사용한 이미지 최적화
        await sharp(imageBuffer)
          .resize(1200, 1200, { // 최대 크기 제한
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 }) // JPEG 품질 조정
          .toFile(filePath);

        return {
          filename: fileName,
          path: filePath
        };
      } catch (error) {
        console.error('이미지 처리 오류:', error);
        return null;
      }
    };

    // 대화 내 이미지 처리
    console.log('대화에서 이미지 추출 중...');
    
    for (const msg of parsedConversation) {
      if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
        console.log(`메시지에서 ${msg.images.length}개 이미지 발견`);
        
        for (const image of msg.images) {
          try {
            if (image.data) {
              const processedImage = await processImage(image.data, image.name);
              if (processedImage) {
                attachments.push(processedImage);
                console.log(`이미지 처리 성공: ${processedImage.filename}`);
              }
            }
          } catch (imgError) {
            console.error('이미지 처리 오류:', imgError);
          }
        }
      }
    }
    
    console.log(`총 ${attachments.length}개 이미지 첨부 준비 완료`);
    
    // 이메일 옵션 설정
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      cc: parentEmail,
      subject: `[이도초등학교] ${parsedStudentInfo.grade}학년 ${parsedStudentInfo.class}반 ${parsedStudentInfo.name} 학부모님 문의(${status})(${requestType})`,
      text: emailBody,
      attachments: attachments
    };
    
    // 이메일 발송
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      debug: true
    });
    
    await transporter.verify();
    console.log('SMTP 서버 연결 성공');
    
    const info = await transporter.sendMail(mailOptions);
    console.log('이메일 전송 완료:', info.messageId);
    
    res.status(200).json({
      success: true,
      message: '교사와 학부모에게 이메일이 성공적으로 전송되었습니다.',
      messageId: info.messageId,
      attachmentsCount: attachments.length
    });
  } catch (error) {
    console.error('이메일 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: '이메일 처리 중 오류가 발생했습니다: ' + error.message
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

// 분석 엔드포인트 추가
app.post('/analyze', async (req, res) => {
  try {
    const { message, studentInfo, conversation } = req.body;
    
    // 기존의 /api/chat 엔드포인트와 동일한 로직 사용
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '메시지가 비어있습니다.'
      });
    }

    // 문서 데이터 확인 및 로드
    if (documentStore.length === 0) {
      await loadAllFilesFromDirectory();
    }

    // 쿼리 임베딩 생성
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    });
    
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    
    // 관련 문서 검색
    const searchResults = documentStore
      .map(doc => ({
        content: doc.content,
        metadata: doc.metadata,
        similarity: calculateCosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // 상위 3개 결과
    
    // 관련 링크 찾기
    const relevantLinks = findRelevantLinks(message, searchResults);
    
    // 응답 생성
    res.status(200).json({
      success: true,
      response: botResponse,
      sources: searchResults.map(item => item.metadata.source),
      relevantLinks: relevantLinks
    });
  } catch (error) {
    console.error('분석 오류:', error);
    res.status(500).json({
      success: false,
      error: '분석 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 서버 시작
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

module.exports = app;