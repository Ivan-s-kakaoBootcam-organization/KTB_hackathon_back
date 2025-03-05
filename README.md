# 이도 초등학교 학부모 소통 챗봇

교권 보호와 원활한 학부모-교사 소통을 위한 AI 기반 챗봇 시스템입니다. 이 프로젝트는 학부모의 질문을 먼저 수집하고 분류하여 교사에게 정리된 형태로 전달함으로써 교사의 업무 부담을 줄이는 것을 목표로 합니다.

## 주요 기능

- **챗봇 인터페이스**: 학부모는 사용하기 쉬운 웹 인터페이스를 통해 문의사항을 전달
- **RAG 기반 응답 생성**: 학교 가정통신문과 공지사항을 기반으로 정확한 정보 제공
- **자동 상태 분류**: 대화 내용을 분석하여 [해결], [미해결], [확인 부탁] 상태로 자동 분류
- **교사 이메일 발송**: 정리된 문의 내용을 담임 교사에게 이메일로 전달

## 기술 스택

- **프론트엔드**: React
- **백엔드**: Node.js, Express
- **AI 모델**: OpenAI GPT-4o, Text Embedding API
- **문서 처리**: PDF 파싱 및 임베딩 기반 검색
- **이메일 발송**: Nodemailer

## 프로젝트 구조

```
project-root/
├── client/                  # React 프론트엔드
│   ├── public/
│   ├── src/
│   │   ├── App.js           # 메인 앱 컴포넌트
│   │   ├── App.css          # 스타일시트
│   │   └── ...
│   └── package.json
├── server/                  # Express 백엔드
│   ├── server.js            # 메인 서버 파일
│   ├── uploads/             # PDF 업로드 디렉토리
│   └── package.json
├── .env                     # 환경 변수 (API 키 등)
└── README.md
```

## 설치 및 실행 방법

### 필수 요구사항

- Node.js 16.x 이상
- npm 또는 yarn
- OpenAI API 키

### 백엔드 설정

1. 필요한 패키지 설치:
```bash
cd server
npm install
```

2. `.env` 파일 설정:
```
OPENAI_API_KEY=your_openai_api_key
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
EMAIL_FROM=chatbot@idoschool.edu
PORT=3001
```

3. 서버 실행:
```bash
npm start
```

### 프론트엔드 설정

1. 필요한 패키지 설치:
```bash
cd client
npm install
```

2. 개발 모드로 실행:
```bash
npm start
```

3. 프로덕션 빌드:
```bash
npm run build
```

## 개발 모드에서 실행하기

개발 중에는 백엔드와 프론트엔드를 별도로 실행하는 것이 좋습니다:

1. 백엔드 서버 실행 (3001번 포트):
```bash
cd server
npm run dev  # nodemon을 사용한 개발 모드
```

2. 프론트엔드 개발 서버 실행 (3000번 포트):
```bash
cd client
npm start
```

3. 브라우저에서 `http://localhost:3000`으로 접속

## 문서 데이터 업로드

1. 시스템 사용 전에 학교 문서(가정통신문, 공지사항 등)를 PDF 형태로 준비
2. 관리자 페이지를 통해 문서 업로드 (`/admin` 경로)
3. 업로드된 문서는 자동으로 처리되어 챗봇의 지식 기반이 됨

## 프로젝트 배포

1. 프론트엔드 빌드:
```bash
cd client
npm run build
```

2. 백엔드 서버가 `client/build` 디렉토리의 정적 파일을 제공함
3. 프로덕션 환경에서 서버 실행:
```bash
cd server
NODE_ENV=production npm start
```

## 문제 해결

- **Cannot GET /**: 백엔드 서버가 실행 중이지만 프론트엔드 파일이 빌드되지 않았거나 경로가 올바르게 설정되지 않은 경우 발생합니다. `client` 디렉토리에서 `npm run build`를 실행하여 프론트엔드를 빌드하세요.

- **API 연결 오류**: 프론트엔드에서 API 요청 경로가 올바른지 확인하세요. 개발 모드에서는 프록시 설정이 필요할 수 있습니다.

- **OpenAI API 오류**: 유효한 API 키가 설정되어 있는지 확인하고, API 사용량 한도를 확인하세요.

## 추가 기능 개발 계획

- 교사 전용 대시보드 구현
- 문의 내역 검색 및 통계 기능
- 학부모 피드백 시스템
- 다국어 지원