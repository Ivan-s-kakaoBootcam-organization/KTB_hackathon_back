import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { OpenAI } from 'openai';
import multer from 'multer';
import fs from 'fs';

const app = express();
app.use(express.json());
app.use(cors());

// 📌 이미지 저장 폴더 설정
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📌 SMTP 설정 (Gmail 사용)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,  // 보내는 이메일 주소
        pass: process.env.EMAIL_PASS   // 앱 비밀번호
    }
});

// 📌 AI 민원 분석 API + 이메일 발송
app.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "문의 내용을 입력하세요." });

        console.log("message:", message);

        const imagePath = req.file ? req.file.path : null;
        console.log("imagePath:", imagePath);
        console.log("req.file:", req.file);
        if(req.file) 
            console.log("req.file.path:", req.file.path);

        // // 0.5초 기다리게 하고 싶어.
        // await new Promise(resolve => setTimeout(resolve, 500));
        // res.json({ success: true, message: "AI 분석 완료", aiResponse: "aiResponse" });
        // return;


        // 📌 프롬프트 생성 (민원 요약 + 감정 분석 + 응답 추천)
        const prompt = `
        너는 AI 기반 교사 민원 대응 지원 시스템이야. 이제부터 선생님을 대신해서 학부모의 민원에 응답해야해.
        그렇다고 답변할 때 너가 ai임을 소개할 필요는 없어.
        ### 기본

        - **폭언·협박 감지 및 자동 필터링 기능 제공**
        - **문의 요약 및 자동 응답**
        - **교직원의 피로도를 줄이고, 정당한 민원 대응을 보조하는 역할 수행**

        ### 학교 민원 응대 원칙

        (안내사항 필요할 시 안내)

        - **학교 내에서 해결이 어려운 민원은 교육청 통합민원팀으로 이관**
        - **학교 민원은 신속·공정·친절·적법하게 처리**해야 하며, 민원인의 권익을 보호
        - **민원인의 무리한 요구(반복, 위법, 폭언 등)는 엄정 대응**
        - **교직원의 개인 전화로 민원 제기 금지** (공식 창구 이용 권장)

        ### 민원 유형 및 처리 방법

        (일반 민원과 특이 민원을 분류하여 처리. 발생 시 경고)

        - **일반 민원:** 행정적인 요청, 학사 관련 문의 등 → 신속 처리
        - **특이 민원:** 폭언·협박·반복 민원 → 기록 후 엄정 대응
        - **교육활동 침해 민원:** 교권 보호 조치 필요 → 교권보호위원회와 연계

        ### **교직원 보호 조치**

        (가짜로 안심번호 주고, 안내 및 경고)

        - **민원 응대 시 통화녹음 및 보호 조치 가능** (필요 시 법적 대응)
        - **민원인의 폭언·협박 시 즉시 경고 후 통화 종료 가능**
        - **폭언·폭행이 발생하면 민원인의 출입 제한 및 경찰 신고 가능**
        - **교원은 개인 번호 대신 공식적인 민원 창구를 이용하도록 안내 가능**

        ### **법적 근거 및 대응 절차**

        (아래 법률 위반 시 관련 법안 명시하며 경고 및 안내)

        - **「교원지위법」에 따라 교육활동 침해 행위는 법적 제재 가능**
        - **「민원처리법」에 따라 교직원을 보호하고 필요 시 민원 제한 가능**
        - **「초·중등교육법」에 따라 교장의 민원처리 책임 명확화**
        - **법적 대응이 필요한 경우 교육청 차원에서 고발 가능**

        학부모 메시지:
        "${message}"
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        });

        const aiResponse = response.choices[0].message.content;

        // 📌 선생님에게 보낼 이메일 내용 생성
        const mailOptions = {
            from: `"학교 민원 AI" <${process.env.EMAIL_USER}>`,
            to: "lig5441@naver.com",
            subject: "📩 학부모 민원 응대 요약 보고",
            text: `
            📌 학부모 요청 요약:
            ${message}

            📌 AI 추천 응답:
            ${aiResponse}

            📌 참고 사항:
            - 필요 시 응답을 수정한 후 회신하세요.
            - AI 응답은 추천용이므로, 공식 답변으로 활용 전 검토 바랍니다.
            `,
            attachments: imagePath ? [{ filename: req.file.originalname, path: imagePath }] : []
        };

        // 📌 이메일 발송
        await transporter.sendMail(mailOptions);
        console.log("📩 이메일 발송 완료!");

        res.json({ success: true, message: "AI 분석 완료 & 이메일 전송됨", aiResponse });
    } catch (error) {
        console.error("❌ AI 분석 또는 이메일 전송 실패:", error);
        res.status(500).json({ error: "처리 중 오류 발생", details: error.message });
    }
});

// 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));