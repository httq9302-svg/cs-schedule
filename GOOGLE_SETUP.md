# 구글 캘린더 연동 설정 가이드

## 1. Google Cloud Console 설정

### 1-1. 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 (예: `cs-schedule`)

### 1-2. Calendar API 활성화
1. 좌측 메뉴 → **API 및 서비스** → **라이브러리**
2. `Google Calendar API` 검색 → **사용 설정**

### 1-3. OAuth 동의 화면 설정
1. **API 및 서비스** → **OAuth 동의 화면**
2. 사용자 유형: **외부** 선택
3. 앱 이름, 이메일 입력 후 저장
4. 범위 추가: `https://www.googleapis.com/auth/calendar`
5. 테스트 사용자에 팀원 이메일 추가

### 1-4. OAuth 2.0 클라이언트 ID 생성
1. **API 및 서비스** → **사용자 인증 정보**
2. **사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 승인된 JavaScript 원본에 앱 URL 추가:
   - 개발: `http://localhost:5173`
   - 배포: `https://your-domain.com`
5. 생성 후 **클라이언트 ID** 복사

### 1-5. API 키 생성
1. **사용자 인증 정보 만들기** → **API 키**
2. 생성된 **API 키** 복사
3. (선택) API 키 제한 설정: Calendar API만 허용

---

## 2. 앱 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
VITE_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 3. 공유 캘린더 ID 확인

1. [Google Calendar](https://calendar.google.com) 접속
2. 사용할 캘린더 옆 **⋮** 클릭 → **설정 및 공유**
3. 하단 **캘린더 통합** 섹션에서 **캘린더 ID** 확인
4. 앱의 **설정** 탭 또는 **동기화** 탭에서 입력

---

## 4. 사용 방법

### 가져오기 (구글 → 앱)
- **동기화** 탭 → **구글 로그인** → 캘린더 선택 → **가져오기**
- 구글 캘린더의 이벤트가 앱으로 불러와집니다

### 반영하기 (앱 → 구글)
- 앱에서 일정 추가/수정 후 **동기화** 탭 → **반영하기**
- 앱의 변경사항이 구글 캘린더에 저장됩니다

### 제목 형식
- 담당자 배정 시 자동으로 `이름 / 업무내용` 형식으로 저장
- 예: `최대리 / 강남 고객사 정기 점검`

---

## 5. 개발 서버 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 빌드
pnpm build
```
