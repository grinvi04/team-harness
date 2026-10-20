import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app';
import { consumeAccessToken, fetchContext } from './api';
import './styles.css';

const queryClient = new QueryClient();
const root = createRoot(document.getElementById('root')!);
let authentication: AbortController | undefined;
let generation = 0;

function authenticate() {
  const requestGeneration = ++generation;
  authentication?.abort();
  // Changing the CLI token starts a new authentication boundary, even for the same viewer IDs.
  queryClient.clear();
  const accessToken = consumeAccessToken();
  if (!accessToken) {
    root.render(<main><h1>접근 주소가 필요합니다</h1><p>메모리 토큰이 없습니다. 터미널에 표시된 CLI 주소를 다시 여세요.</p></main>);
    return;
  }
  const controller = new AbortController();
  authentication = controller;
  root.render(<main><h1>대상 확인 중</h1><p>현재 상태 미확인</p></main>);
  fetchContext(accessToken, controller.signal).then(context => {
    if (controller.signal.aborted || requestGeneration !== generation) return;
    root.render(<StrictMode><QueryClientProvider client={queryClient}><App context={context}/></QueryClientProvider></StrictMode>);
  }).catch(() => {
    if (controller.signal.aborted || requestGeneration !== generation) return;
    root.render(<main><h1>연결을 확인하세요</h1><p>대상 또는 인증 확인 실패 · 현재 상태 미확인. 터미널의 CLI 주소를 다시 여세요.</p></main>);
  });
}

window.addEventListener('hashchange', () => {
  // replaceState consumes the fragment without another event; ignore already-consumed navigation events.
  if (location.hash) authenticate();
});
authenticate();
