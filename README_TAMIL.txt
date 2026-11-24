XPRESS CRICKET ACADEMY – PWA STARTER
=====================================

இந்த ZIP ஒரு ஆரம்ப Demo App. இதில்:
- Coach / Admin demo login: 1234
- Parent demo login: 1111
- Under 10, Under 12, Under 14, Under 16, Under 19
- Player add, search, filter, remove
- Daily attendance
- Installable PWA setup

முக்கிய பாதுகாப்பு குறிப்பு:
இந்த Demo localStorage-ல் இந்த browser/device-இல் மட்டுமே தகவல்களைச் சேமிக்கிறது.
Coach மற்றும் Parent login-கள் demo passcode மட்டுமே; பாதுகாப்பான உண்மையான authentication அல்ல.
பல மொபைல்களில் ஒரே data பகிர, உண்மையான parent account, role permissions, secure cloud database ஆகியவற்றை அடுத்த கட்டத்தில் இணைக்க வேண்டும்.
உண்மையான மாணவர்/பெற்றோர் விவரங்களை இந்த demo-வில் சேர்க்க வேண்டாம்.

LOGO:
உங்கள் தற்போதைய Xpress Cricket Academy logo-வை assets/xpress-logo.png என்ற பெயரில் வைக்கவும்.
நீங்கள் upload செய்த Xpress Cricket Academy logo assets/xpress-logo.png ஆக இணைக்கப்பட்டுள்ளது.

இலவசமாக வெளியிடுவது:
1. GitHub-ல் account உருவாக்கவும்: https://github.com/signup
2. New public repository உருவாக்கவும் (எ.கா. xpress-cricket-academy).
3. ZIP-ஐ extract செய்து உள்ள files அனைத்தையும் repository root-க்கு upload செய்யவும்.
4. Repository Settings > Pages > Deploy from a branch > main > /(root) > Save.
5. சில நிமிடங்களில் GitHub Pages URL கிடைக்கும்.
6. Android Chrome-ல் அந்த URL திறந்து ⋮ > Install app / Add to Home screen தேர்வு செய்யவும்.

PWA நிறுவ HTTPS தேவை. GitHub Pages HTTPS வழங்குகிறது.


VERSION 1.2 – PROTOTYPE EXTENSIONS
- Uploaded Xpress logo included.
- Coach can create demo parent account linked to a player.
- Parent view is filtered to the linked player when using a created demo account.
- Basic runs/wickets figures can be entered and viewed.

IMPORTANT:
This is still an offline browser prototype, NOT production-ready authentication.
Passwords are stored in local browser storage and are not securely hashed.
Login IDs are displayed as mobile numbers, but the prototype login flow uses
the entered demo password to locate a parent record. Do not enter real personal
data. Production use requires Firebase Authentication/Firestore or equivalent,
server-side role checks and security rules, plus secure password reset.
