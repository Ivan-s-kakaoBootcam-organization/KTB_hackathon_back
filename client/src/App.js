import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faPlusCircle, faChevronDown, faChevronUp, faFileAlt, faExternalLinkAlt, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import './App.css';

function App() {
  // 상태 관리
  const [step, setStep] = useState(1); // 1: 학생 정보 입력, 2: 채팅, 3: 결과 요약
  const [studentInfo, setStudentInfo] = useState({
    grade: '',
    class: '',
    name: '',
    parentEmail: '' // 학부모 이메일 추가
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
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
    if (!studentInfo.grade || !studentInfo.class || !studentInfo.name || !studentInfo.parentEmail) {
      alert('모든 학생 정보를 입력해주세요.');
      return;
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentInfo.parentEmail)) {
      alert('유효한 이메일 주소를 입력해주세요.');
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

  // 새 메시지 전송 핸들러
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
    setIsLoading(true);
    setError(null);

    // 로딩 메시지 표시
    const loadingId = Date.now();
    setMessages((prev) => [...prev, {
      id: loadingId,
      text: "답변을 생성 중입니다...",
      sender: 'bot',
      isLoading: true
    }]);

    try {
      // 실제 서버 API 호출
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          studentInfo,
          conversation: messages
        }),
      });

      if (!response.ok) {
        throw new Error('서버 응답 오류');
      }

      const data = await response.json();
      
      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== loadingId));
      setIsLoading(false);
      
      // 실제 응답 추가
      const botResponse = {
        id: Date.now(),
        text: data.response,
        sender: 'bot',
        links: data.relevantLinks || []
      };
      
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error('API 오류:', error);
      setIsLoading(false);
      setError("응답 생성 중 오류가 발생했습니다.");
      
      // 오류 발생 시 로딩 메시지를 오류 메시지로 교체
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingId 
            ? { 
                ...msg, 
                text: "서버 연결에 문제가 있어 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.", 
                isLoading: false, 
                isError: true 
              }
            : msg
        )
      );
    }
  };

  // 채팅 완료 핸들러
  const handleFinishChat = async () => {
    setIsLoading(true);

    try {
      // 대화 내용 분류 API 호출
      const classifyResponse = await fetch('http://localhost:3001/api/classify-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: messages,
          studentInfo
        }),
      });

      if (!classifyResponse.ok) {
        throw new Error('대화 분류 오류');
      }

      const classifyData = await classifyResponse.json();
      setEmailStatus(classifyData.status);

      // 대화 요약 API 호출
      const summaryResponse = await fetch('http://localhost:3001/api/summarize-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: messages,
          studentInfo
        }),
      });

      if (!summaryResponse.ok) {
        throw new Error('대화 요약 오류');
      }

      const summaryData = await summaryResponse.json();
      setConversationSummary(summaryData.summary);

      // 이메일 발송 API 호출
      await fetch('http://localhost:3001/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: messages,
          studentInfo,
          status: classifyData.status,
          summary: summaryData.summary,
          parentEmail: studentInfo.parentEmail // 학부모 이메일 전달
        }),
      });

      setIsLoading(false);
      setStep(3);
    } catch (error) {
      console.error('API 오류:', error);
      setIsLoading(false);
      setError('요약 및 이메일 처리 중 오류가 발생했습니다.');
      
      // 오류 상황에서도 기본 상태 설정하고 진행
      if (!emailStatus) setEmailStatus('[확인 부탁]');
      setStep(3);
    }
  };

  // 처음으로 돌아가기
  const handleRestart = () => {
    setStep(1);
    setStudentInfo({
      grade: '',
      class: '',
      name: '',
      parentEmail: '',
    });
    setMessages([]);
    setNewMessage('');
    setEmailStatus('');
    setConversationSummary({
      topic: '',
      keyPoints: ['문의 내용을 분석 중입니다...'],
      links: []
    });
    setShowConversation(false);
    setIsLoading(false);
    setError(null);
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

              <div className="form-group">
                <label>학부모 이메일</label>
                <input
                  type="email"
                  name="parentEmail"
                  value={studentInfo.parentEmail}
                  onChange={handleStudentInfoChange}
                  placeholder="이메일 주소를 입력하세요"
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
                  className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'} ${message.isLoading ? 'loading' : ''} ${message.isError ? 'error' : ''}`}
                >
                  {message.text}
                  {message.links && message.links.length > 0 && (
                    <div className="message-links">
                      <p>관련 링크:</p>
                      <ul>
                        {message.links.map((link, index) => (
                          <li key={index}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              {link.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading}>전송</button>
            </form>

            <button 
              onClick={handleFinishChat} 
              className="finish-button"
              disabled={isLoading || messages.length < 3}
            >
              {isLoading ? '처리 중...' : '채팅 완료'}
            </button>
            
            {error && <p className="error-message">{error}</p>}
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
              위 내용이 {studentInfo.grade}학년 {studentInfo.class}반 담임 선생님과 
              학부모님({studentInfo.parentEmail})께 {emailStatus} 태그와 함께 이메일로 전송되었습니다.
            </p>
            <button onClick={handleRestart}>처음으로 돌아가기</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;