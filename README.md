# 학부모-교사 소통 챗봇 프로젝트 설치 및 실행 가이드

이 가이드는 학부모-교사 소통 챗봇 프로젝트를 설치하고 실행하는 방법을 안내합니다.

## 프로젝트 구조

프로젝트는 클라이언트(React)와 서버(Node.js/Express) 두 부분으로 나뉩니다:

```
parent-teacher-chatbot/
├── client/                    # 프론트엔드 (React)
│   ├── src/
│   │   ├── App.js             # 메인 애플리케이션 컴포넌트
│   │   ├── App.css            # 스타일 정의
│   │   └── ...
│   └── ...
├── server/                    # 백엔드 (Node.js/Express)
│   ├── server.js              # Express 서버, RAG 시스템
│   ├── uploads/               # 업로드된 PDF/TXT 문서 저장 디렉토리
│   │   ├── 3월 급식.txt
│   │   ├── 학사일정.txt
│   │   └── ...
│   └── ...
└── ...
```

## 1. 필수 요구사항

- Node.js 18.x 이상
- npm 9.x 이상
- OpenAI API 키

## 2. 프로젝트 설치

다음 명령어를 순서대로 실행하여 프로젝트를 설치합니다:

### 2.1. 저장소 클론 또는 소스코드 다운로드

```bash
git clone <저장소URL> parent-teacher-chatbot
cd parent-teacher-chatbot
```

### 2.2. 클라이언트 설치

```bash
cd client
npm install
cd ..
```

### 2.3. 서버 설치

```bash
cd server
npm install
```

### 2.4. 환경 변수 설정

서버 디렉토리에서 `.env` 파일을 생성하고 다음 내용을 입력합니다:

```
OPENAI_API_KEY=your_openai_api_key_here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com
NODE_ENV=production
EMAIL_ENABLED=true
```

> **참고**: Gmail을 사용하는 경우 앱 비밀번호를 생성해야 합니다. 일반 비밀번호는 작동하지 않습니다.

### 2.5. 문서 디렉토리 생성

서버 디렉토리에 uploads 폴더가 없는 경우 생성합니다:

```bash
mkdir -p uploads
```

필요한 문서 파일(TXT 또는 PDF)을 uploads 폴더에 복사합니다.

## 3. 프로젝트 실행

### 3.1. 서버 실행

서버 디렉토리에서:

```bash
node server.js
```

서버가 성공적으로 시작되면 다음과 같은 메시지가 표시됩니다:
```
서버가 포트 3001에서 실행 중입니다.
업로드 디렉토리에서 파일 로드 중...
...
서버 시작 시 [N]개 파일 로드됨
```

### 3.2. 클라이언트 실행

새 터미널 창을 열고 클라이언트 디렉토리로 이동합니다:

```bash
cd client
npm start
```

클라이언트가 시작되면 브라우저가 자동으로 열리고 (또는 http://localhost:3000 으로 접속) 애플리케이션을 사용할 수 있습니다.

## 4. 주요 기능

- 학생 정보 및 학부모 이메일 입력
- 학부모 질문에 대한 RAG 기반 응답 생성
- TXT/PDF 문서 기반 정보 제공
- 대화 내용 자동 분류 및 요약
- 담임 교사와 학부모에게 이메일 전송 기능
- 학교 관련 링크 자동 제공

## 5. 문제 해결

### 서버가 시작되지 않는 경우
- `.env` 파일이 올바르게 구성되었는지 확인합니다.
- 필요한 모든 패키지가 설치되었는지 확인합니다.
- 포트 3001이 이미 사용 중인지 확인합니다.

### 이메일이 전송되지 않는 경우
- 이메일 설정이 올바른지 확인합니다.
- Gmail을 사용하는 경우, 앱 비밀번호를 사용 중인지 확인합니다.
- `EMAIL_ENABLED=true`로 설정되어 있는지 확인합니다.

### OpenAI API 오류
- API 키가 올바른지 확인합니다.
- API 사용량 한도를 초과했는지 확인합니다.

## 6. 추가 자원

- 더 많은 정보나 지원이 필요하면 문서를 참조하거나 프로젝트 관리자에게 문의하세요.