# Duck Buddy 🦆

Kod yazarkən səni izləyən, xətada kədərlənən, uğurda sevinən ördək.

## Quraşdırma (.vsix düzəltmək)

Öz kompüterində (Node.js quraşdırılmış olmalıdır), bu qovluqda:

```
npm install -g @vscode/vsce
vsce package --allow-missing-repository
```

Nəticədə `duck-buddy-0.1.0.vsix` faylı yaranır. Onu dostuna göndər.

## Dostunda quraşdırma

1. VS Code-da Extensions bölməsini aç
2. Yuxarıdakı `...` menyusundan **Install from VSIX...** seç
3. `.vsix` faylını seç
4. Sol tərəfdəki activity bar-da ördək ikonuna bas

## Sınaq

`Ctrl+Shift+P` → **Duck Buddy: Bütün reaksiyaları göstər (demo)** yazsan, ördək bütün hallarını ardıcıl göstərəcək.

## Ördək nə vaxt nə edir

| Hadisə | Reaksiya |
|---|---|
| VS Code açılır | Salamlayır |
| Kod yazılır | Monitora baxır |
| Error yaranır | Ağlayır, "?!" |
| Xəta düzəlir / build uğurlu | Sevinir |
| Testlər PASS | Rəqs edir |
| Testlər FAIL | Yağış buludu altında məyus olur |
| 90 saniyə yazılmır | Yatır |
| 2 dəqiqə xəta düzəlmir | Səbirsiz gözləyir |
| Günün ilk uğurlu build-i | Konfetili celebration |

## Qeyd

Build/test hadisələri iki yolla tutulur: VS Code Tasks və terminalda əmr bitməsi (VS Code 1.93+, shell integration). Əmrin adında `test`, `jest`, `pytest` kimi sözlər varsa, test sayılır.
