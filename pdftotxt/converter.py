import fitz  # PyMuPDF
import os

# 변환할 PDF 파일들이 있는 디렉터리 경로
pdf_dir = "/Users/jeong-yujin/Downloads/parent-teacher-chatbot/server/uploads"

# PDF 파일을 찾아 txt로 변환하는 함수
def convert_pdfs_to_txt(pdf_directory):
    # 디렉터리 내 모든 파일 조회
    for filename in os.listdir(pdf_directory):
        if filename.lower().endswith(".pdf"):  # PDF 파일만 처리
            pdf_path = os.path.join(pdf_directory, filename)
            txt_path = os.path.splitext(pdf_path)[0] + ".txt"  # 확장자를 .txt로 변경

            # PDF 열기
            doc = fitz.open(pdf_path)
            text = ""

            # 모든 페이지의 텍스트 추출
            for page in doc:
                text += page.get_text("text") + "\n"

            # 텍스트 파일로 저장
            wth open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)

            print(f"✅ 변환 완료: {filename} → {os.path.basename(txt_path)}")

# 함수 실행
convert_pdfs_to_txt(pdf_dir)
