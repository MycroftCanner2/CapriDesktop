"""Crow Companion 1.0.1: Tallow is a male crow ("he"), in every language.

Fixes the Capri leftovers in the interface text: the transliterated name (Капри, カプリ, 카프리),
German "Capris", feminine pronouns and agreement, and the cyberpunk voice wording.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
I18N = ROOT / 'src/renderer/src/i18n'

NAME = [(r'Капри', 'Таллоу'), (r'カプリ', 'タロウ'), (r'카프리', '탤로우'), (r'卡普里', 'Tallow'), (r'\bCapris\b', 'Tallows'), (r'\bCapri\b', 'Tallow')]

O = {
 'deck_tabChatTitle': {'en': 'Chat with Tallow, with his view in the background', 'pt': 'Converse com o Tallow, com a visão dele ao fundo', 'de': 'Mit Tallow chatten, seine Sicht im Hintergrund', 'ru': 'Чат с Таллоу, его взгляд на фоне', 'zh': '与 Tallow 聊天,背景显示他的视野'},
 'deck_voiceOnTitle': {'en': 'Tallow speaks in Dev Mode. Click to mute him', 'es': 'Tallow habla en modo dev. Clic para silenciarlo', 'pt': 'O Tallow fala no modo dev. Clique para silenciar', 'fr': 'Tallow parle en mode dev. Cliquez pour le couper', 'it': 'Tallow parla in modalità dev. Clicca per silenziarlo'},
 'deck_voiceOffTitle': {'en': 'Tallow is muted in Dev Mode. Click to hear him', 'es': 'Tallow está silenciado en modo dev. Clic para escucharlo', 'pt': 'O Tallow está silenciado no modo dev. Clique para ouvir', 'fr': 'Tallow est muet en mode dev. Cliquez pour l’entendre', 'de': 'Tallow ist im Dev-Modus stumm. Klicken, um ihn zu hören', 'it': 'Tallow è silenziato in modalità dev. Clicca per sentirlo', 'ru': 'Таллоу молчит в режиме разработчика. Нажмите, чтобы слышать его'},
 'cp_statusTitle': {'en': 'Click to write to Tallow (or Ctrl + click on him)', 'es': 'Clic para escribirle a Tallow (o Ctrl + clic sobre él)', 'pt': 'Clique para escrever para o Tallow (ou Ctrl + clique nele)', 'fr': 'Cliquez pour écrire à Tallow (ou Ctrl + clic sur lui)', 'de': 'Klicken, um Tallow zu schreiben (oder Strg + Klick auf ihn)', 'it': 'Clicca per scrivere a Tallow (o Ctrl + clic su di lui)', 'ru': 'Нажмите, чтобы написать Таллоу (или Ctrl + клик по нему)', 'zh': '点击给 Tallow 写消息(或按 Ctrl 点击他)'},
 'cp_listeningTitle': {'en': 'Always listening: say "Tallow" to talk to him. Click or → to turn it off.', 'pt': 'Sempre ouvindo: diga "Tallow" para falar com ele. Clique ou → para desligar.', 'de': 'Hört dauerhaft zu: Sag „Tallow“, um mit ihm zu sprechen. Klick oder → zum Ausschalten.', 'it': 'Sempre in ascolto: di’ "Tallow" per parlargli. Clic o → per spegnere.', 'ru': 'Постоянное прослушивание: скажите «Таллоу», чтобы обратиться к нему. Клик или →, чтобы выключить.', 'zh': '持续聆听:说“Tallow”即可与他对话。点击或按 → 关闭。'},
 'lang_textHelp': {'en': 'Language he writes in: chat, bubbles and game reactions. It also sets the language of this interface.', 'pt': 'Idioma em que ele escreve: chat, balões e reações de jogos. Também define o idioma desta interface.', 'fr': 'Langue dans laquelle il écrit : chat, bulles et réactions de jeu. Définit aussi la langue de cette interface.', 'de': 'Sprache, in der er schreibt: Chat, Sprechblasen und Spielreaktionen. Legt auch die Sprache dieser Oberfläche fest.', 'ru': 'Язык, на котором он пишет: чат, реплики и реакции в играх. Также задаёт язык этого интерфейса.', 'zh': '他书写所用的语言:聊天、气泡和游戏反应。也会设置此界面的语言。'},
 'lang_textAuto': {'en': 'Automatic (the language you talk to him in)', 'pt': 'Automático (o idioma em que você fala com ele)', 'de': 'Automatisch (die Sprache, in der du mit ihm sprichst)', 'it': 'Automatica (la lingua in cui gli parli)', 'ru': 'Автоматически (язык, на котором вы с ним говорите)', 'zh': '自动(你对他说话的语言)'},
 'lang_speechHelp': {'en': "Language he speaks in. If it's different from the text, the line is translated by his model before he says it.", 'pt': 'Idioma em que ele fala. Se for diferente do texto, o modelo traduz a frase antes de dizer.', 'fr': 'Langue dans laquelle il parle. Si elle diffère du texte, son modèle traduit la phrase avant de la dire.', 'de': 'Sprache, in der er spricht. Weicht sie vom Text ab, übersetzt sein Modell den Satz vorher.', 'ru': 'Язык его речи. Если он отличается от текста, модель переводит фразу перед произнесением.', 'zh': '他说话所用的语言。如果与文字不同,模型会先翻译再说。'},
 'llm_privacy': {'en': 'In cloud mode, your messages, screenshots when you ask him to scan your screen and your name are sent to this provider. Comments in the background also consume your credit.'},
 'vs_testPhrase': {'en': "Hi! I'm Tallow, the crow on your desktop. What's on your mind?", 'es': '¡Hola! Soy Tallow, el cuervo de tu escritorio. ¿En qué estás pensando?', 'pt': 'Oi! Eu sou o Tallow, o corvo da sua área de trabalho. No que você está pensando?', 'fr': 'Salut ! Je suis Tallow, le corbeau de ton bureau. À quoi tu penses ?', 'de': 'Hi! Ich bin Tallow, der Rabe auf deinem Desktop. Woran denkst du gerade?', 'it': 'Ciao! Sono Tallow, il corvo del tuo desktop. A cosa stai pensando?', 'ru': 'Привет! Я Таллоу, ворон с твоего рабочего стола. О чём думаешь?', 'ja': 'やあ！デスクトップのカラス、タロウだよ。何を考えてるの？', 'ko': '안녕! 나는 바탕화면의 까마귀 탤로우야. 무슨 생각 해?', 'zh': '你好!我是 Tallow,住在你桌面上的乌鸦。你在想什么?'},
 'vs_dsp': {'en': 'Voice filter (DSP) & pitch', 'es': 'Filtro de voz (DSP) y tono', 'pt': 'Filtro de voz (DSP) e tom', 'fr': 'Filtre vocal (DSP) et hauteur', 'de': 'Stimmfilter (DSP) & Tonhöhe', 'it': 'Filtro vocale (DSP) e tono', 'ru': 'Голосовой фильтр (DSP) и высота', 'ja': '音声フィルター (DSP) とピッチ', 'ko': '음성 필터(DSP) 및 음높이', 'zh': '语音滤镜 (DSP) 与音高'},
 'vs_dspAndroid': {'en': 'high pitch + light echo, default', 'es': 'agudo + eco suave, por defecto', 'pt': 'agudo + eco suave, padrão', 'fr': 'aigu + léger écho, par défaut', 'de': 'hoch + leichtes Echo, Standard', 'it': 'acuto + eco leggera, predefinito', 'ru': 'высокий + лёгкое эхо, по умолчанию', 'ja': '高音＋軽いエコー、既定', 'ko': '고음 + 가벼운 에코, 기본값', 'zh': '高音 + 轻微回声,默认'},
 'vs_dspAguda': {'en': 'extra high', 'es': 'extra agudo', 'pt': 'extra agudo', 'fr': 'très aigu', 'de': 'extra hoch', 'it': 'extra acuto', 'ru': 'очень высокий', 'ja': '超高音', 'ko': '초고음', 'zh': '超高音'},
 'vs_hotkeyTalk': {'en': 'Talk to him', 'pt': 'Falar com ele', 'de': 'Mit ihm sprechen', 'it': 'Parlargli', 'ru': 'Поговорить с ним', 'zh': '和他说话'},
 'vs_hotkeyChat': {'en': 'Open his chat', 'pt': 'Abrir o chat dele', 'de': 'Seinen Chat öffnen', 'ru': 'Открыть его чат', 'zh': '打开他的聊天'},
 'vs_gamingOpacity': {'en': 'His opacity in Gaming Mode', 'pt': 'A opacidade dele no modo gaming', 'de': 'Seine Deckkraft im Gaming-Modus', 'ru': 'Его непрозрачность в игровом режиме', 'zh': '他在游戏模式下的不透明度'},
 'vs_glitchSound': {'en': 'Wing-flap sound when he changes animation', 'es': 'Sonido de aleteo al cambiar de animación', 'pt': 'Som de bater de asas ao mudar de animação', 'fr': "Bruit d'ailes quand il change d'animation", 'de': 'Flügelschlag-Ton beim Animationswechsel', 'it': "Suono d'ali quando cambia animazione", 'ru': 'Звук взмаха крыльев при смене анимации', 'ja': 'アニメーション変更時の羽ばたき音', 'ko': '애니메이션 변경 시 날갯짓 소리', 'zh': '切换动画时的振翅音效'},
 'ob_moveModels': {'en': 'His models', 'pt': 'Os modelos dele', 'de': 'Seine Modelle', 'ru': 'Его модели', 'ja': 'モデル', 'zh': '他的模型'},
 'ob_moveWhisper': {'en': 'His hearing (Whisper)', 'pt': 'A audição dele (Whisper)', 'de': 'Sein Gehör (Whisper)', 'ru': 'Его слух (Whisper)', 'ja': '聴覚 (Whisper)', 'zh': '他的听觉 (Whisper)'},
 'ob_moveVoiceEnv': {'en': 'His voice environment', 'pt': 'O ambiente de voz dele', 'de': 'Seine Sprachumgebung', 'ru': 'Его голосовая среда', 'ja': '音声環境', 'zh': '他的语音环境'},
 'ob_moveNote': {'en': "It's copied first and the old files are deleted only at the end. Python stays where it is. To move Tallow himself, move the whole Crow Companion folder.", 'es': 'Primero se copia y lo viejo se borra recién al final. Python queda donde está. Para mover a Tallow, mové toda la carpeta de Crow Companion.', 'pt': 'Primeiro é copiado, e os arquivos antigos só são apagados no final. O Python fica onde está. Para mover o próprio Tallow, mova a pasta inteira do Crow Companion.', 'fr': "Tout est d'abord copié, et les anciens fichiers ne sont supprimés qu'à la fin. Python reste où il est. Pour déplacer Tallow lui-même, déplace tout le dossier Crow Companion.", 'de': 'Zuerst wird kopiert, die alten Dateien werden erst am Ende gelöscht. Python bleibt, wo es ist. Um Tallow selbst zu verschieben, verschiebe den ganzen Crow-Companion-Ordner.', 'it': "Prima viene copiato e i vecchi file vengono eliminati solo alla fine. Python resta dov'è. Per spostare Tallow stesso, sposta tutta la cartella di Crow Companion.", 'ru': 'Сначала всё копируется, а старые файлы удаляются только в конце. Python остаётся на месте. Чтобы перенести самого Таллоу, перенеси всю папку Crow Companion.', 'ja': '先にコピーし、古いファイルは最後に削除します。Python はそのままです。Tallow 本体を移動するには、Crow Companion フォルダーごと移動してください。', 'ko': '먼저 복사한 뒤 이전 파일은 마지막에 삭제합니다. Python은 그대로 둡니다. Tallow 자체를 옮기려면 Crow Companion 폴더 전체를 옮기세요.', 'zh': '先复制,旧文件最后才删除。Python 保持原位。要移动 Tallow 本身,请移动整个 Crow Companion 文件夹。'},
 'ob_moveDone': {'en': "Moved. He's using the new location.", 'pt': 'Pronto. Ele já usa o novo local.', 'fr': "C'est fait. Il utilise le nouvel emplacement.", 'de': 'Fertig. Er nutzt jetzt den neuen Ort.', 'ru': 'Готово. Теперь он использует новое место.', 'ja': '完了しました。新しい場所を使っています。', 'zh': '完成。他已在使用新位置。'},
 'vs_boredom': {'en': 'Let him get bored: he opens tabs and music by himself when you are quiet', 'pt': 'Deixar ele ficar entediado: abre abas e música sozinho quando você não fala', 'fr': "Il peut s'ennuyer : il ouvre des onglets et de la musique tout seul quand tu ne dis rien", 'de': 'Er darf sich langweilen: öffnet von selbst Tabs und Musik, wenn du still bist', 'it': 'Può annoiarsi: apre schede e musica da solo quando non gli parli', 'zh': '允许他感到无聊: 你不说话时他会自己打开标签页和音乐'},
 'vs_testPlaceholder': {'en': 'Type what you want him to say...', 'pt': 'Digite o que você quer que ele diga...', 'fr': 'Écrivez ce que vous voulez qu’il dise...', 'de': 'Schreib, was er sagen soll...', 'ru': 'Напишите, что он должен сказать...', 'zh': '输入你想让他说的话...'},
}

# Leftover feminine agreement for Tallow, per language (run after the name fix)
GENERIC = {
 'pt': [(r'\bA Tallow\b', 'O Tallow'), (r'\ba Tallow\b', 'o Tallow'), (r'\bà Tallow\b', 'ao Tallow'), (r'\bda Tallow\b', 'do Tallow'), (r'\bna Tallow\b', 'no Tallow'), (r'\bpela Tallow\b', 'pelo Tallow'), (r'\bcom a Tallow\b', 'com o Tallow')],
 'zh': [(r'她', '他')],
 'ja': [(r'彼女', '彼')],
}

def esc(v: str) -> str:
    return v.replace('\\', '\\\\').replace("'", "\\'")

def fix_i18n() -> None:
    for p in sorted(I18N.glob('*.ts')):
        if p.name == 'index.ts':
            continue
        lang = p.stem
        s = p.read_text(encoding='utf-8')
        for a, b in NAME:
            s = re.sub(a, b, s)
        for a, b in GENERIC.get(lang, []):
            s = re.sub(a, b, s)
        for key, per in O.items():
            if lang not in per:
                continue
            s, n = re.subn(rf"^(  {key}: )(['\"`])(?:\\.|(?!\2).)*\2(,?)$", lambda m: f"{m.group(1)}'{esc(per[lang])}'{m.group(3)}", s, flags=re.M)
            if n != 1:
                raise SystemExit(f'{p.name}: {key} not found')
        p.write_text(s, encoding='utf-8')

if __name__ == '__main__':
    fix_i18n()
