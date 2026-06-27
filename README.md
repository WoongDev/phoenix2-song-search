# PHOENIX 2 Song Search

PUMP IT UP PHOENIX 2 곡 검색용 정적 웹페이지입니다.

## 파일 구성

- `index.html`: 화면 구조
- `style.css`: 디자인
- `search.js`: 검색 기능
- `phoenix2_songs.json`: 곡 데이터

## GitHub Pages 배포

1. GitHub 저장소에서 `uploading an existing file`을 누릅니다.
2. 이 폴더 안의 파일 4개를 모두 업로드합니다.
   - `index.html`
   - `style.css`
   - `search.js`
   - `phoenix2_songs.json`
   - `README.md`
3. `Commit changes`를 누릅니다.
4. 저장소의 `Settings > Pages`로 이동합니다.
5. `Source`를 `Deploy from a branch`로 선택합니다.
6. `Branch`는 `main`, 폴더는 `/root`로 선택하고 저장합니다.
7. 잠시 기다린 뒤 표시되는 GitHub Pages 주소로 접속합니다.

## 데이터 갱신

엑셀에서 JSON을 다시 만든 뒤, 기존 `phoenix2_songs.json` 파일만 교체하면 됩니다.
