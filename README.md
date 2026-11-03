# 산행 — 함께 걷는 힐링 등산 게임

링크만 열면 같은 산에서 만나는 3D 등산 게임이에요.

- `https://내주소/?room=maru` → **maru** 방
- `https://내주소/?mt=hallasan&room=maru` → 한라산의 **maru** 방
- `https://내주소/` → 누구나 만나는 **모두의 산**

산: `bukhansan`(북한산) · `seoraksan`(설악산) · `jirisan`(지리산) · `hallasan`(한라산) · `naejangsan`(내장산)

같은 `room` 이름으로 들어온 사람끼리만 서로 보여요. 로그인은 필요 없어요.

## 구성

| 파일 | 하는 일 |
|---|---|
| `server.js` | 게임 페이지 제공 + `/ws` 웹소켓으로 같은 방 사람들의 위치·인사 중계 |
| `public/index.html` | 게임 (Three.js, 새소리·바람 소리 합성) |
| `render.yaml` | Render 배포 설정 |

서버는 위치를 중계만 하고 아무것도 저장하지 않아요. 닉네임과 좌표는 서버에서 검사·정리한 뒤 전달해요. 한 방에 최대 40명까지 들어갈 수 있어요.

## 내 컴퓨터에서 실행

```bash
npm install
npm start
# http://localhost:3000/?room=maru 를 창 두 개로 열어보세요
```

## 인터넷에 올리기 (Render, 무료)

1. 이 폴더를 GitHub 저장소에 올려요.
2. https://render.com 에 GitHub로 로그인해요.
3. **New → Blueprint**를 누르고 저장소를 고르면 `render.yaml`을 읽어서 바로 만들어줘요.
   (또는 **New → Web Service**: Build `npm install`, Start `npm start`)
4. 배포가 끝나면 `https://sanhaeng-xxxx.onrender.com/?room=maru` 같은 주소가 생겨요.

무료 플랜은 15분 동안 아무도 없으면 잠들어요. 다음 사람이 들어올 때 깨어나는 데 30초~1분 정도 걸려요.

> Vercel은 웹소켓 서버를 계속 띄워둘 수 없어서 이 구성에는 맞지 않아요. Render, Fly.io, Railway 같은 곳을 쓰세요.

## 상태 확인

`/health` → `{"ok":true,"rooms":1,"players":2}`  
`/api/mountains` → 산별 지금 오르는 사람 수 `{"hallasan":2}`
