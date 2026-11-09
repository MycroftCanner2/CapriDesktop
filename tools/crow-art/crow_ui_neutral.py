"""Crow Companion 1.0.1: UI strings that used to be Tallow talking (preset lines) become neutral
app wording, in every language. Tallow's own words only ever come from his model."""
import json, re, sys
from pathlib import Path

K = ['cc_lineDone','cc_lineWorking','cc_lineIdle','mic_noAccess','mic_notHeard','ed_chatEmpty',
     'ob_hello','ob_helloSub','ob_auto','ob_nameTitle','ob_nameHint','ob_brainSub','ob_setupTitle',
     'ob_setupSub','ob_setupSubCloud','ob_doneSub','ob_pythonDesc','ob_ffmpegDesc','ob_modelDesc',
     'ob_personaTitle','ob_personaDesc','vs_micHeard','vs_micUnderstood','vs_micNoWords']

T = {
'en': ['Done.','Working on it…','Tallow is perched.','Could not access the microphone. Check permissions.','No speech recognized. Try again.','Ask about the open file, or use a quick action below.',
       'Meet Tallow.','A crow who lives on your desktop. Set up a couple of things first.','Automatic (the language you write or speak in)','Your name','Shown in the app. You can change it later.','Choose what runs the model: Tallow on this PC, or another provider.','Components',
       'Voice, hearing and the local model need these pieces. Everything runs on this PC.','Voice and hearing need these pieces. They run on this PC; your provider runs the model.','Click Tallow to open the panel, use ↓ to talk to him, or turn on always-listening with →.','Python + Whisper (hearing) + Edge-TTS (voice) · ~1 GB','Audio processing for the voice','qwen2.5-coder 7B, only for the Ollama brain · ~4.7 GB',
       'Ollama persona','The "capri" Ollama model, only for the Ollama brain','Sound is coming in.','Recognized:','Sound is coming in, but no words were recognized.'],
'es': ['Listo.','Trabajando…','Tallow está posado.','No se pudo acceder al micrófono. Revisá los permisos.','No se reconoció voz. Probá de nuevo.','Preguntá sobre el archivo abierto o usá una acción rápida abajo.',
       'Te presento a Tallow.','Un cuervo que vive en tu escritorio. Primero configurá un par de cosas.','Automático (el idioma en que escribas o hables)','Tu nombre','Se muestra en la app. Podés cambiarlo después.','Elegí qué ejecuta el modelo: Tallow en esta PC u otro proveedor.','Componentes',
       'La voz, el oído y el modelo local necesitan estas piezas. Todo corre en esta PC.','La voz y el oído necesitan estas piezas. Corren en esta PC; tu proveedor ejecuta el modelo.','Hacé clic en Tallow para abrir el panel, usá ↓ para hablarle o activá la escucha continua con →.','Python + Whisper (oído) + Edge-TTS (voz) · ~1 GB','Procesamiento de audio para la voz','qwen2.5-coder 7B, solo para el cerebro Ollama · ~4.7 GB',
       'Persona de Ollama','El modelo "capri" de Ollama, solo para el cerebro Ollama','Está entrando sonido.','Reconocido:','Entra sonido, pero no se reconocieron palabras.'],
'pt': ['Pronto.','Trabalhando…','O Tallow está empoleirado.','Não foi possível acessar o microfone. Verifique as permissões.','Nenhuma fala reconhecida. Tente de novo.','Pergunte sobre o arquivo aberto ou use uma ação rápida abaixo.',
       'Conheça o Tallow.','Um corvo que vive na sua área de trabalho. Primeiro, configure algumas coisas.','Automático (o idioma em que você escrever ou falar)','Seu nome','Aparece no app. Você pode mudar depois.','Escolha o que executa o modelo: o Tallow neste PC ou outro provedor.','Componentes',
       'Voz, audição e o modelo local precisam destas peças. Tudo roda neste PC.','Voz e audição precisam destas peças. Elas rodam neste PC; seu provedor executa o modelo.','Clique no Tallow para abrir o painel, use ↓ para falar com ele ou ative a escuta contínua com →.','Python + Whisper (audição) + Edge-TTS (voz) · ~1 GB','Processamento de áudio para a voz','qwen2.5-coder 7B, só para o cérebro Ollama · ~4.7 GB',
       'Persona do Ollama','O modelo "capri" do Ollama, só para o cérebro Ollama','O som está chegando.','Reconhecido:','O som está chegando, mas nenhuma palavra foi reconhecida.'],
'fr': ['Terminé.','En cours…','Tallow est perché.','Impossible d’accéder au micro. Vérifie les autorisations.','Aucune parole reconnue. Réessaie.','Pose une question sur le fichier ouvert ou utilise une action rapide ci-dessous.',
       'Voici Tallow.','Un corbeau qui vit sur ton bureau. Configure d’abord deux ou trois choses.','Automatique (la langue dans laquelle tu écris ou parles)','Ton nom','Affiché dans l’app. Tu pourras le changer plus tard.','Choisis ce qui exécute le modèle : Tallow sur ce PC ou un autre fournisseur.','Composants',
       'La voix, l’écoute et le modèle local ont besoin de ces éléments. Tout tourne sur ce PC.','La voix et l’écoute ont besoin de ces éléments. Ils tournent sur ce PC ; ton fournisseur exécute le modèle.','Clique sur Tallow pour ouvrir le panneau, utilise ↓ pour lui parler ou active l’écoute continue avec →.','Python + Whisper (écoute) + Edge-TTS (voix) · ~1 Go','Traitement audio pour la voix','qwen2.5-coder 7B, uniquement pour le cerveau Ollama · ~4.7 Go',
       'Persona Ollama','Le modèle Ollama « capri », uniquement pour le cerveau Ollama','Du son arrive.','Reconnu :','Du son arrive, mais aucun mot n’a été reconnu.'],
'de': ['Fertig.','Wird bearbeitet…','Tallow sitzt auf seiner Stange.','Kein Zugriff auf das Mikrofon. Prüfe die Berechtigungen.','Keine Sprache erkannt. Versuch es noch einmal.','Frag etwas zur geöffneten Datei oder nutze unten eine Schnellaktion.',
       'Das ist Tallow.','Eine Krähe, die auf deinem Desktop wohnt. Richte zuerst ein paar Dinge ein.','Automatisch (die Sprache, in der du schreibst oder sprichst)','Dein Name','Wird in der App angezeigt. Du kannst ihn später ändern.','Wähle, was das Modell ausführt: Tallow auf diesem PC oder ein anderer Anbieter.','Komponenten',
       'Stimme, Hören und das lokale Modell brauchen diese Teile. Alles läuft auf diesem PC.','Stimme und Hören brauchen diese Teile. Sie laufen auf diesem PC; dein Anbieter führt das Modell aus.','Klick auf Tallow, um das Panel zu öffnen, nutze ↓, um mit ihm zu sprechen, oder aktiviere mit → das Dauerzuhören.','Python + Whisper (Hören) + Edge-TTS (Stimme) · ~1 GB','Audioverarbeitung für die Stimme','qwen2.5-coder 7B, nur für das Ollama-Gehirn · ~4.7 GB',
       'Ollama-Persona','Das Ollama-Modell „capri“, nur für das Ollama-Gehirn','Es kommt Ton an.','Erkannt:','Es kommt Ton an, aber es wurden keine Wörter erkannt.'],
'it': ['Fatto.','Al lavoro…','Tallow è appollaiato.','Impossibile accedere al microfono. Controlla i permessi.','Nessuna voce riconosciuta. Riprova.','Chiedi qualcosa sul file aperto o usa un’azione rapida qui sotto.',
       'Ecco Tallow.','Un corvo che vive sul tuo desktop. Prima configura un paio di cose.','Automatica (la lingua in cui scrivi o parli)','Il tuo nome','Mostrato nell’app. Puoi cambiarlo dopo.','Scegli cosa esegue il modello: Tallow su questo PC o un altro provider.','Componenti',
       'Voce, ascolto e modello locale hanno bisogno di questi pezzi. Tutto gira su questo PC.','Voce e ascolto hanno bisogno di questi pezzi. Girano su questo PC; il tuo provider esegue il modello.','Clicca su Tallow per aprire il pannello, usa ↓ per parlargli o attiva l’ascolto continuo con →.','Python + Whisper (ascolto) + Edge-TTS (voce) · ~1 GB','Elaborazione audio per la voce','qwen2.5-coder 7B, solo per il cervello Ollama · ~4.7 GB',
       'Persona di Ollama','Il modello Ollama "capri", solo per il cervello Ollama','Il suono arriva.','Riconosciuto:','Il suono arriva, ma non è stata riconosciuta nessuna parola.'],
'ru': ['Готово.','В работе…','Таллоу сидит на жёрдочке.','Нет доступа к микрофону. Проверь разрешения.','Речь не распознана. Попробуй ещё раз.','Спроси об открытом файле или выбери быстрое действие ниже.',
       'Это Таллоу.','Ворон, который живёт на твоём рабочем столе. Сначала настрой пару вещей.','Автоматически (язык, на котором ты пишешь или говоришь)','Твоё имя','Показывается в приложении. Можно изменить позже.','Выбери, что запускает модель: Таллоу на этом ПК или другой провайдер.','Компоненты',
       'Голосу, слуху и локальной модели нужны эти компоненты. Всё работает на этом ПК.','Голосу и слуху нужны эти компоненты. Они работают на этом ПК; модель запускает твой провайдер.','Нажми на Таллоу, чтобы открыть панель, стрелка ↓ — чтобы поговорить с ним, а → включает постоянное прослушивание.','Python + Whisper (слух) + Edge-TTS (голос) · ~1 ГБ','Обработка звука для голоса','qwen2.5-coder 7B, только для мозга Ollama · ~4.7 ГБ',
       'Персона Ollama','Модель Ollama «capri», только для мозга Ollama','Звук поступает.','Распознано:','Звук поступает, но слова не распознаны.'],
'zh': ['完成。','处理中…','Tallow 正栖息着。','无法访问麦克风。请检查权限。','未识别到语音。请再试一次。','询问已打开的文件，或使用下方的快捷操作。',
       '这是 Tallow。','一只住在你桌面上的乌鸦。先设置几项内容。','自动（你书写或说话所用的语言）','你的名字','显示在应用中。之后可以更改。','选择由什么来运行模型：本机上的 Tallow，或其他服务商。','组件',
       '语音、听觉和本地模型需要这些组件。一切都在本机运行。','语音和听觉需要这些组件。它们在本机运行；模型由你的服务商运行。','点击 Tallow 打开面板，按 ↓ 和他说话，或按 → 开启持续聆听。','Python + Whisper（听觉）+ Edge-TTS（语音）· 约 1 GB','语音的音频处理','qwen2.5-coder 7B，仅用于 Ollama 大脑 · 约 4.7 GB',
       'Ollama 人设','Ollama 的 "capri" 模型，仅用于 Ollama 大脑','有声音输入。','识别结果：','有声音输入，但未识别出任何词语。'],
'ja': ['完了。','作業中…','タロウは止まり木にいます。','マイクにアクセスできません。権限を確認してください。','音声を認識できませんでした。もう一度お試しください。','開いているファイルについて質問するか、下のクイックアクションを使ってください。',
       'タロウです。','デスクトップに住むカラス。まずいくつか設定しましょう。','自動（書いたり話したりする言語）','あなたの名前','アプリ内に表示されます。後で変更できます。','モデルを動かすものを選んでください：このPCのタロウ、または別のプロバイダー。','コンポーネント',
       '音声、聞き取り、ローカルモデルにはこれらが必要です。すべてこのPCで動きます。','音声と聞き取りにはこれらが必要です。このPCで動き、モデルはプロバイダーが動かします。','タロウをクリックするとパネルが開きます。↓キーで彼に話しかけ、→キーで常時聞き取りをオンにできます。','Python + Whisper（聞き取り）+ Edge-TTS（音声）· 約1 GB','音声のオーディオ処理','qwen2.5-coder 7B、Ollama の頭脳専用 · 約4.7 GB',
       'Ollama のペルソナ','Ollama の「capri」モデル、Ollama の頭脳専用','音が入っています。','認識結果：','音は入っていますが、言葉を認識できませんでした。'],
'ko': ['완료.','작업 중…','탤로우가 횃대에 앉아 있어요.','마이크에 접근할 수 없습니다. 권한을 확인하세요.','음성을 인식하지 못했습니다. 다시 시도하세요.','열린 파일에 대해 묻거나 아래의 빠른 작업을 사용하세요.',
       '탤로우를 소개합니다.','데스크톱에 사는 까마귀. 먼저 몇 가지를 설정하세요.','자동 (쓰거나 말하는 언어)','이름','앱에 표시됩니다. 나중에 바꿀 수 있습니다.','모델을 실행할 것을 고르세요: 이 PC의 탤로우 또는 다른 제공자.','구성 요소',
       '음성, 듣기, 로컬 모델에 이 구성 요소가 필요합니다. 모두 이 PC에서 실행됩니다.','음성과 듣기에 이 구성 요소가 필요합니다. 이 PC에서 실행되며, 모델은 제공자가 실행합니다.','탤로우를 클릭하면 패널이 열리고, ↓로 그에게 말하고, →로 상시 듣기를 켤 수 있습니다.','Python + Whisper (듣기) + Edge-TTS (음성) · 약 1 GB','음성용 오디오 처리','qwen2.5-coder 7B, Ollama 두뇌 전용 · 약 4.7 GB',
       'Ollama 페르소나','Ollama의 "capri" 모델, Ollama 두뇌 전용','소리가 들어오고 있습니다.','인식됨:','소리는 들어오지만 단어를 인식하지 못했습니다.'],
}
root = Path(__file__).resolve().parents[2] / 'src/renderer/src/i18n'
bad = 0
for lang, vals in T.items():
    assert len(vals) == len(K), (lang, len(vals))
    p = root / f'{lang}.ts'
    s = p.read_text()
    for k, v in zip(K, vals):
        pat = re.compile(rf"^(  {k}: ).*?,\s*$", re.M)
        if not pat.search(s):
            print('missing', lang, k); bad += 1; continue
        s = pat.sub(lambda m: m.group(1) + json.dumps(v, ensure_ascii=False) + ',', s, count=1)
    p.write_text(s)
sys.exit(1 if bad else 0)
