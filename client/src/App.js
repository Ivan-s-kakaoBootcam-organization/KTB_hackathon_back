// App.js
import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // 상태 관리
  const [step, setStep] = useState(1); // 1: 학생 정보 입력, 2: 채팅, 3: 결과 요약
  const [studentInfo, setStudentInfo] = useState({
    grade: '',
    class: '',
    name: '',
  });
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState(''); // [해결], [미해결], [확인 부탁]
  const [conversationSummary, setConversationSummary] = useState({
    topic: '',
    keyPoints: ['문의 내용을 분석 중입니다...'],
    links: []
  });
  const [showConversation, setShowConversation] = useState(false);
  const messagesEndRef = useRef(null);

  // 메시지 목록이 업데이트될 때마다 스크롤을 아래로 이동
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 학생 정보 입력 변경 핸들러
  const handleStudentInfoChange = (e) => {
    const { name, value } = e.target;
    setStudentInfo({
      ...studentInfo,
      [name]: value,
    });
  };

  // 학생 정보 제출 핸들러
  const handleSubmitStudentInfo = (e) => {
    e.preventDefault();
    // 모든 필드가 입력되었는지 확인
    if (!studentInfo.grade || !studentInfo.class || !studentInfo.name) {
      alert('모든 학생 정보를 입력해주세요.');
      return;
    }
    
    // 채팅 단계로 이동
    setStep(2);
    
    // 초기 인사 메시지 추가
    setMessages([
      {
        id: Date.now(),
        text: `${studentInfo.name} 학생의 학부모님, 안녕하세요! 이도 초등학교 챗봇입니다. 무엇을 도와드릴까요?`,
        sender: 'bot',
      },
    ]);
  };
// App.js에서 handleSendMessage 함수 수정
const handleSendMessage = async (e) => {
  e.preventDefault();
  if (!newMessage.trim()) return;

  // 새 메시지 추가
  const userMessage = {
    id: Date.now(),
    text: newMessage,
    sender: 'user',
  };

  setMessages((prev) => [...prev, userMessage]);
  setNewMessage('');

  // 로딩 상태 메시지 추가
  const loadingMessage = {
    id: Date.now() + 1,
    text: "답변을 생성 중입니다...",
    sender: 'bot',
    isLoading: true
  };
  setMessages(prev => [...prev, loadingMessage]);

  try {
    // 서버에 요청
    console.log("서버에 요청 보내는 중:", {
      message: userMessage.text,
      studentInfo,
      conversation: messages
    });

    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage.text,
        studentInfo,
        conversation: messages
      }),
    });

    const data = await response.json();
    console.log("서버 응답:", data);

    // 로딩 메시지 제거
    setMessages(prev => prev.filter(msg => !msg.isLoading));

    // 응답 추가
    if (data.success !== false) {
      const botResponse = {
        id: Date.now() + 2,
        text: data.response,
        sender: 'bot',
      };
      setMessages(prev => [...prev, botResponse]);
    } else {
      // 오류 메시지 표시
      const errorMessage = {
        id: Date.now() + 2,
        text: `오류가 발생했습니다: ${data.error || '알 수 없는 오류'}`,
        sender: 'bot',
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  } catch (error) {
    console.error("API 요청 오류:", error);
    // 로딩 메시지 제거
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    
    // 오류 메시지 추가
    const errorMessage = {
      id: Date.now() + 2,
      text: "서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      sender: 'bot',
      isError: true
    };
    setMessages(prev => [...prev, errorMessage]);
  }
};

  // 간단한 봇 응답 생성 (실제 RAG 구현은 OpenAI API로 대체)
  const getBotResponse = (message) => {
    // 실제 구현에서는 OpenAI API를 호출하여 RAG 시스템으로 응답 생성
    if (message.includes('가정통신문')) {
      return '가정통신문은 매주 금요일에 발송됩니다. 최근 가정통신문은 학교 홈페이지에서도 확인하실 수 있습니다.';
    } else if (message.includes('급식')) {
      return '급식 메뉴는 학교 홈페이지의 "급식 안내" 메뉴에서 확인하실 수 있습니다.';
    } else if (message.includes('상담')) {
      return '선생님과의 상담은 사전 예약이 필요합니다. 원하시는 날짜와 시간을 알려주시면 선생님께 전달하겠습니다.';
    } else {
      return '죄송합니다. 말씀하신 내용에 대한 정보가 부족합니다. 선생님께 직접 전달하도록 하겠습니다.';
    }
  };

  // 채팅 완료 핸들러
  const handleFinishChat = async () => {
    // 간단한 분류 로직 (실제로는 더 복잡한 AI 분류 사용)
    let status = '[확인 부탁]'; // 기본값
    
    const allText = messages.map(m => m.text).join(' ').toLowerCase();
    
    if (allText.includes('상담') || allText.includes('면담')) {
      status = '[확인 부탁]';
    } else if (allText.includes('감사') || allText.includes('해결')) {
      status = '[해결]';
    } else if (allText.includes('문제') || allText.includes('불만')) {
      status = '[미해결]';
    }
    
    setEmailStatus(status);
    
    // 대화 내용 요약 생성 (실제로는 서버 API를 호출)
    // 여기서는 간단한 예시로 구현
    const generateSummary = () => {
      // 실제 구현에서는 서버에 API 요청
      
      // 대화 주제 추출
      let topic = '일반 문의';
      if (allText.includes('교육비') || allText.includes('지원')) {
        topic = '교육비 지원 문의';
      } else if (allText.includes('체육') || allText.includes('대회')) {
        topic = '도민체육대회 관련 문의';
      } else if (allText.includes('일정') || allText.includes('행사')) {
        topic = '학교 일정 문의';
      }
      
      // 키포인트 추출 (실제로는 AI가 분석)
      const keyPoints = [];
      if (allText.includes('신청')) keyPoints.push('교육비 지원 신청 방법 문의');
      if (allText.includes('기간')) keyPoints.push('신청 기간 문의');
      if (allText.includes('서류')) keyPoints.push('필요 서류 문의');
      if (allText.includes('자격')) keyPoints.push('지원 자격 문의');
      
      // 링크 추천 (실제로는 문서 분석 기반으로 제공)
      const links = [];
      if (topic === '교육비 지원 문의') {
        links.push({
          title: '교육비 지원 안내 페이지',
          url: 'https://www.ido.school.edu/support'
        });
      } else if (topic === '도민체육대회 관련 문의') {
        links.push({
          title: '제59회 도민체육대회 안내',
          url: 'https://www.ido.school.edu/sports'
        });
      }
      
      // 키포인트가 없으면 기본값 설정
      if (keyPoints.length === 0) {
        keyPoints.push('학부모님의 질문에 대한 정보 제공');
        keyPoints.push('필요시 담임교사의 추가 확인 필요');
      }
      
      return {
        topic,
        keyPoints,
        links
      };
    };
    
    const summary = generateSummary();
    setConversationSummary(summary);
    setStep(3);
  };

  // 처음으로 돌아가기
  const handleRestart = () => {
    setStep(1);
    setStudentInfo({
      grade: '',
      class: '',
      name: '',
    });
    setMessages([]);
    setNewMessage('');
    setEmailStatus('');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>이도 초등학교 학부모 소통 챗봇</h1>
      </header>

      <main>
        {step === 1 && (
          <div className="student-info-container">
            <h2>학생 정보 입력</h2>
            <form onSubmit={handleSubmitStudentInfo}>
              <div className="form-group">
                <label>학년</label>
                <select 
                  name="grade" 
                  value={studentInfo.grade} 
                  onChange={handleStudentInfoChange}
                  required
                >
                  <option value="">선택하세요</option>
                  {[1, 2, 3, 4, 5, 6].map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}학년
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>반</label>
                <select 
                  name="class" 
                  value={studentInfo.class} 
                  onChange={handleStudentInfoChange}
                  required
                >
                  <option value="">선택하세요</option>
                  {[1, 2, 3, 4, 5].map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}반
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>학생 이름</label>
                <input
                  type="text"
                  name="name"
                  value={studentInfo.name}
                  onChange={handleStudentInfoChange}
                  placeholder="학생 이름을 입력하세요"
                  required
                />
              </div>

              <button type="submit">채팅 시작하기</button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="chat-container">
            <div className="student-info-display">
              <p>
                {studentInfo.grade}학년 {studentInfo.class}반 {studentInfo.name} 학생
              </p>
            </div>

            <div className="messages-container">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
                >
                  {message.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="메시지를 입력하세요..."
              />
              <button type="submit">전송</button>
            </form>

            <button onClick={handleFinishChat} className="finish-button">
              채팅 완료
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="summary-container">
            <h2>상담 요약</h2>
            <div className="summary-content">
              <p>
                <strong>학생 정보:</strong> {studentInfo.grade}학년 {studentInfo.class}반 {studentInfo.name}
              </p>
              <p>
                <strong>문의 상태:</strong> {emailStatus}
              </p>
              
              {/* 요약 정보 섹션 */}
              <div className="summary-points">
                <h3>요약 정보:</h3>
                <ul>
                  <li><strong>주제:</strong> {conversationSummary.topic || '학부모 문의'}</li>
                  <li><strong>주요 논의사항:</strong></li>
                  <ul>
                    {conversationSummary.keyPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                  {conversationSummary.links && conversationSummary.links.length > 0 && (
                    <>
                      <li><strong>관련 링크:</strong></li>
                      <ul>
                        {conversationSummary.links.map((link, index) => (
                          <li key={index}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              {link.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </ul>
              </div>
              
              {/* 토글 가능한 대화 내용 섹션 */}
              <div className="conversation-toggle">
                <button 
                  onClick={() => setShowConversation(!showConversation)}
                  className="toggle-button"
                >
                  {showConversation ? '대화 내용 숨기기 ▲' : '대화 내용 보기 ▼'}
                </button>
                
                {showConversation && (
                  <div className="message-summary">
                    {messages.map((message) => (
                      <p key={message.id} className={message.sender}>
                        <strong>{message.sender === 'user' ? '학부모' : '챗봇'}:</strong> {message.text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="email-sent">
              위 내용이 {studentInfo.grade}학년 {studentInfo.class}반 담임 선생님께 
              {emailStatus} 태그와 함께 이메일로 전송되었습니다.
            </p>
            <button onClick={handleRestart}>처음으로 돌아가기</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;