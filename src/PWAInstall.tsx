import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstall() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowGuide(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      setShowGuide(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  }

  if (installed || (!installEvent && !isIOS)) return null;

  return <>
    <button className="pwa-install-button" onClick={install} type="button">
      <Download size={17} />
      <span>Instalar aplicativo</span>
    </button>
    {showGuide && <div className="pwa-guide-backdrop" onClick={() => setShowGuide(false)}>
      <section className="pwa-guide" role="dialog" aria-modal="true" aria-label="Como instalar o aplicativo" onClick={event => event.stopPropagation()}>
        <button className="pwa-guide-close" type="button" onClick={() => setShowGuide(false)} aria-label="Fechar"><X size={19}/></button>
        <div className="pwa-guide-icon"><Share2 size={25}/></div>
        <h2>Instale no seu celular</h2>
        {isIOS ? <>
          <p>No Safari do iPhone ou iPad:</p>
          <ol><li>Toque no botão <b>Compartilhar</b> do navegador.</li><li>Role as opções e escolha <b>Adicionar à Tela de Início</b>.</li><li>Confirme em <b>Adicionar</b>.</li></ol>
        </> : <>
          <p>Abra o menu do navegador e escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</p>
        </>}
        <button className="pwa-guide-ok" type="button" onClick={() => setShowGuide(false)}>Entendi</button>
      </section>
    </div>}
  </>;
}
