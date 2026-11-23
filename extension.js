const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const SLEEP_AFTER_MS = 90 * 1000;        // bu qədər yazılmasa ördək yatır
const IMPATIENT_AFTER_MS = 2 * 60 * 1000; // xəta bu qədər düzəldilməsə ördək səbirsizləşir
const BREAK_AFTER_MS = 50 * 60 * 1000;
const TEST_RE = /\b(test|tests|jest|mocha|vitest|pytest|unittest|phpunit)\b/i;
const DEFAULT_NAME = 'Quackie';
const DEFAULT_ACCESSORY = 'none';

const phrases = {
  greet: ['Salam! Mən {name}-yəm 👋', 'Hazıram, {name} buradadır!', 'Kod macərasına başlayaq!'],
  typing: ['Monitoru izləyirəm 👀', 'Barmaqların sürətlidir!', 'Bu kod maraqlı görünür.'],
  fast: ['Vay, çox sürətli yazırsan! Gözlərim böyüdü 👀', 'Bir az yavaş, {name} hələ oxuyur!', 'Klaviaturadan qığılcımlar çıxır!'],
  error: ['Xəta var 😢', 'Bir balaca problem tapdım…', 'Bu sətir məni kədərləndirdi.'],
  impatient: ['Xəta hələ də yerindədir… 👀', 'Bu xəta ilə barışa bilmirəm!', 'Düzəlsə, çox xoşbəxt olaram.'],
  happy: ['{name} sevindi! ✨', 'Uğurla işlədi!', 'Əla! Bu dəfə hər şey qaydasındadır.'],
  dance: ['{name} rəqs edir! Testlər PASS! 🎉', 'Testlər keçdi, rəqs vaxtıdır!', 'Yaşasın! Bütün testlər yaşıl oldu.'],
  sad: ['Testlər FAIL oldu… 😞', 'Build alınmadı, amma birlikdə düzəldərik.', 'Bu dəfə olmadı…'],
  celebrate: ['{name} sevindi! Günün ilk uğurlu build-i 🏆', 'Bu qələbə qeyd olunmalıdır!', 'Build uğurludur, konfeti gətirin!'],
  git: ['{name} commit və push-a sevindi! 🚀', 'Kod uzaqlara göndərildi, əla işdir!', 'Git qələbəsi! {name} rəqs edir!'],
  click: ['Quack! 🦆', 'Vak-vak!', '{name} fırlandı!'],
  head: ['Başımı sığalladın, çox xoş oldu!', '{name} xoşbəxtdir! 💛', 'Bu toxunuş əladır!'],
  angry: ['Bir az sakit, {name} əsəbiləşir! 😤', 'Bu qədər klik kifayətdir!', 'Vak-vak! Mənə toxunma!'],
  feed: ['Mmm, dadlı! Sağ ol!', '{name} yeməkdən sonra daha xoşbəxtdir! 🍎', 'Ləzzətli idi!'],
  break: ['Su iç, ayağa qalx 🚰', 'Fasilə vaxtıdır, bir az gəziş!', 'Gözlərini dincəlt, {name}.'],
  night: ['Gecə oldu, yatmaq vaxtıdır 🌙', '{name} deyir: daha kod yazma!', 'Gecə papağım hazırdır. Yuxu vaxtıdır!'],
};

let view;
let current = { state: 'idle', text: '' };
let typingTimer, idleTimer, revertTimer, breakTimer, nightTimer;
let errorSince = null;
let duckName = DEFAULT_NAME;
let accessory = DEFAULT_ACCESSORY;
let resting = false;
let recentTyping = [];
let fastTypingUntil = 0;

function randomPhrase(state) {
  const options = phrases[state] || [];
  return (options[Math.floor(Math.random() * options.length)] || '')
    .replaceAll('{name}', duckName);
}

function speak(state) {
  post(state, randomPhrase(state));
}

function sendConfig() {
  if (view) view.webview.postMessage({ type: 'config', name: duckName, accessory });
}

function post(state, text = '') {
  current = { state, text };
  if (view) view.webview.postMessage(current);
}

function errorCount() {
  let n = 0;
  for (const [, diags] of vscode.languages.getDiagnostics()) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) n++;
    }
  }
  return n;
}

// Heç bir xüsusi hadisə yoxdursa ördək nə etməlidir
function baseline() {
  if (resting) return;
  if (errorCount() > 0) {
    if (errorSince && Date.now() - errorSince > IMPATIENT_AFTER_MS) {
      speak('impatient');
    } else {
      speak('error');
    }
  } else {
    post('idle', '');
  }
}

function revertSoon(ms = 6000) {
  clearTimeout(revertTimer);
  revertTimer = setTimeout(baseline, ms);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!resting) post('sleep', 'zzz…');
  }, SLEEP_AFTER_MS);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function handleResult(context, ok, name) {
  const isTest = TEST_RE.test(name || '');
  clearTimeout(typingTimer);
  if (ok) {
    if (isTest) {
      speak('dance');
    } else if (context.globalState.get('lastCelebration') !== today()) {
      context.globalState.update('lastCelebration', today());
      speak('celebrate');
    } else {
      speak('happy');
    }
  } else {
    post('sad', isTest ? randomPhrase('sad') : 'Build alınmadı 😞');
  }
  revertSoon(7000);
  resetIdleTimer();
}

class DuckViewProvider {
  constructor(context) {
    this.context = context;
  }
  resolveWebviewView(webviewView) {
    view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    const nonce = Math.random().toString(36).slice(2);
    const file = path.join(this.context.extensionPath, 'media', 'duck.html');
    webviewView.webview.html = fs
      .readFileSync(file, 'utf8')
      .replace(/__NONCE__/g, nonce);
    webviewView.onDidDispose(() => { view = undefined; });
    webviewView.webview.onDidReceiveMessage((m) => {
      if (m && m.ready) {
        sendConfig();
        speak('greet');
        revertSoon(5000);
      } else if (m && m.type === 'duckClick') {
        speak('click');
        revertSoon(2500);
      } else if (m && m.type === 'headClick') {
        speak('head');
        revertSoon(2500);
      } else if (m && m.type === 'angry') {
        speak('angry');
        revertSoon(3000);
      } else if (m && m.type === 'feed') {
        speak('feed');
        revertSoon(3000);
      } else if (m && m.type === 'sleep') {
        resting = true;
        post('sleep', 'zzz…');
      } else if (m && m.type === 'wake') {
        resting = false;
        speak('greet');
        resetIdleTimer();
        revertSoon(3000);
      } else if (m && m.type === 'setName') {
        duckName = String(m.name || DEFAULT_NAME).trim().slice(0, 24) || DEFAULT_NAME;
        this.context.globalState.update('duckName', duckName);
        sendConfig();
        speak('happy');
      } else if (m && m.type === 'setAccessory') {
        accessory = ['none', 'glasses', 'cap', 'night'].includes(m.accessory) ? m.accessory : DEFAULT_ACCESSORY;
        this.context.globalState.update('accessory', accessory);
        sendConfig();
      }
    });
  }
}

function handleShellEvent(context, event) {
  if (event.exitCode === undefined) return;
  const command = event.execution.commandLine.value || '';
  const lowerCommand = command.toLowerCase();
  if (/\bgit\s+(commit|push)\b/.test(lowerCommand)) {
    if (event.exitCode === 0) {
      post('celebrate', randomPhrase('git'));
      revertSoon(7000);
    } else {
      speak('sad');
      revertSoon(5000);
    }
    return;
      }
  handleResult(context, event.exitCode === 0, command);
}

function activate(context) {
  duckName = context.globalState.get('duckName', DEFAULT_NAME);
  accessory = context.globalState.get('accessory', DEFAULT_ACCESSORY);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('duckBuddy.view', new DuckViewProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Yazılır
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme === 'output' || e.contentChanges.length === 0) return;
      clearTimeout(revertTimer);
      const now = Date.now();
      const changedCharacters = e.contentChanges.reduce((total, change) => total + change.text.length, 0);
      recentTyping = recentTyping.filter((time) => now - time < 1500);
      for (let index = 0; index < changedCharacters; index++) recentTyping.push(now);
      if (recentTyping.length >= 18 && now > fastTypingUntil) {
        fastTypingUntil = now + 2500;
        speak('fast');
        revertSoon(2500);
      } else {
        speak('typing');
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(baseline, 1800);
      resetIdleTimer();
    })
  );

  // Xəta yarananda / düzələndə
  let hadErrors = false;
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      const n = errorCount();
      if (n > 0 && !hadErrors) {
        hadErrors = true;
        errorSince = Date.now();
        if (current.state !== 'typing') speak('error');
      } else if (n === 0 && hadErrors) {
        hadErrors = false;
        errorSince = null;
        speak('happy');
        revertSoon(4000);
      }
    })
  );

  // Uzun müddət düzəldilməyən xəta
  const impatientCheck = setInterval(() => {
    if (errorSince && Date.now() - errorSince > IMPATIENT_AFTER_MS && current.state === 'error') {
      post('impatient', 'Xəta hələ də yerindədir… 👀');
    }
  }, 20000);
  context.subscriptions.push({ dispose: () => clearInterval(impatientCheck) });

  // Task (build/test) bitəndə
  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      handleResult(context, e.exitCode === 0, e.execution.task.name);
    })
  );

  // Terminalda əmr bitəndə (VS Code 1.93+ shell integration)
  if (vscode.window.onDidEndTerminalShellExecution) {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((e) => {
        handleShellEvent(context, e);
      })
    );
  }

  // Əmrlər
  context.subscriptions.push(
    vscode.commands.registerCommand('duckBuddy.show', () =>
      vscode.commands.executeCommand('duckBuddy.view.focus')
    ),
    vscode.commands.registerCommand('duckBuddy.demo', async () => {
      await vscode.commands.executeCommand('duckBuddy.view.focus');
      const steps = [
        ['greet', randomPhrase('greet')], ['typing', randomPhrase('typing')], ['error', randomPhrase('error')],
        ['impatient', randomPhrase('impatient')], ['happy', randomPhrase('happy')],
        ['dance', randomPhrase('dance')], ['sad', randomPhrase('sad')],
        ['celebrate', randomPhrase('celebrate')], ['sleep', 'zzz…'],
      ];
      for (const [s, t] of steps) {
        post(s, t);
        await new Promise((r) => setTimeout(r, 3500));
      }
      baseline();
    })
  );

  breakTimer = setInterval(() => speak('break'), BREAK_AFTER_MS);
  nightTimer = setInterval(() => {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 6) {
      post('night', randomPhrase('night'));
    }
  }, 60 * 1000);
  if (vscode.window.onDidChangeActiveColorTheme) {
    context.subscriptions.push(vscode.window.onDidChangeActiveColorTheme(() => {
      const hour = new Date().getHours();
      if (hour >= 23 || hour < 6) post('night', randomPhrase('night'));
    }));
  }
  resetIdleTimer();
}

function deactivate() {
  clearTimeout(typingTimer);
  clearTimeout(idleTimer);
  clearTimeout(revertTimer);
  clearInterval(breakTimer);
  clearInterval(nightTimer);
}

module.exports = { activate, deactivate };
