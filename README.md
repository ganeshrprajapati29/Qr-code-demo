# दुकान का उधार खाता (Udhar Khata)

फ़ोन पर चलने वाला वेब ऐप जिसमें दुकानदार अपने ग्राहकों का **उधार** और **जमा** लिखता है, हर ग्राहक का **कुल बाक़ी** अपने आप देखता है, और एक बटन से **WhatsApp / SMS** पर याद दिलाता है।

**Stack:** Node.js + Express 5 · MongoDB (Mongoose) · React 19 + Vite · nginx + Let's Encrypt (HTTPS) · GitHub Actions (CI/CD)

> सारा डेमो डेटा नकली है (फ़ोन नंबर `90000000xx`)।

---

## फ़ीचर (ज़रूरत के हिसाब से)

| # | ज़रूरत | कैसे पूरी हुई |
|---|---|---|
| 1 | ग्राहक जोड़ना | “+ नया ग्राहक” → नाम + 10 अंकों का मोबाइल। ग़लत नंबर और डुप्लीकेट नंबर रोके जाते हैं। |
| 2 | उधार / जमा दर्ज करना | ग्राहक खोलें → “उधार दिया” या “जमा मिला” → रक़म, तारीख़, नोट। एंट्री से पहले ही नया बाक़ी दिखता है। |
| 3 | कुल बाक़ी | `बाक़ी = कुल उधार − कुल जमा` — सर्वर पर MongoDB aggregation से, रक़म **पैसे (integer)** में सेव होती है ताकि दशमलव की ग़लती न हो। हर एंट्री के आगे चलता हुआ बाक़ी भी दिखता है। |
| 4 | लिस्ट और खोज | सभी ग्राहक, ऊपर कुल लेना/एडवांस। नाम (हिंदी/English) या नंबर से खोज; क्रम: ज़्यादा बाक़ी / हाल के / नाम। |
| 5 | याद दिलाने का मैसेज | “याद दिलाएँ” → **WhatsApp पर भेजें** (wa.me, मैसेज पहले से लिखा) या **SMS भेजें** — दोनों मुफ़्त। **ऑटोमैटिक भेजें** बटन official WhatsApp Cloud API से भेजता है (टोकन डालने पर); टोकन न हो तो साफ़ बताता है क्यों नहीं गया और ख़र्च की तालिका दिखाता है। |
| 6 | डेटा सुरक्षित | सारा डेटा सर्वर के MongoDB में — पेज बंद करें, फ़ोन बदलें, डेटा वही रहेगा। |

अतिरिक्त: ग्राहक का नाम/नंबर बदलना, ग्राहक या एंट्री हटाना, डार्क मोड, होम-स्क्रीन पर ऐप की तरह जोड़ना (PWA manifest)।

## मैसेज भेजने का ख़र्च

| तरीक़ा | सेवा | अनुमानित ख़र्च |
|---|---|---|
| WhatsApp बटन (चालू) | wa.me लिंक, दुकानदार का अपना WhatsApp | ₹0 |
| SMS बटन (चालू) | दुकानदार के फ़ोन का SMS | मोबाइल प्लान के अनुसार |
| ऑटोमैटिक WhatsApp | Meta WhatsApp Cloud API | ~₹0.12–0.15 प्रति Utility मैसेज + Meta Business verification + approved template |
| ऑटोमैटिक SMS | MSG91 / Fast2SMS आदि | ~₹0.15–0.25 प्रति SMS + DLT रजिस्ट्रेशन (TRAI) |

दरें Meta/प्रोवाइडर बदलते रहते हैं — लाइव करने से पहले जाँच लें।

## मासिक ख़र्च (होस्टिंग)

| चीज़ | ख़र्च |
|---|---|
| VPS (पहले से मौजूद VPS पर) | ₹0 अतिरिक्त · अलग से लें तो ~₹400–800/माह (1–2 GB RAM) |
| MongoDB | ₹0 (उसी VPS पर Docker में) |
| डोमेन | ₹0 (`<ip>.sslip.io`) · अपना डोमेन ~₹800–1,000/साल |
| HTTPS सर्टिफ़िकेट | ₹0 (Let's Encrypt, अपने आप रिन्यू) |
| मैसेज | ऊपर की तालिका के अनुसार (बटन वाले तरीक़े ₹0) |

---

## लोकल पर चलाना

```bash
# 1) MongoDB चालू रखें (local या Docker):  docker run -d -p 27017:27017 mongo:8.0
cd server && cp .env.example .env && npm install && npm run seed && npm run dev
cd client && npm install && npm run dev        # http://localhost:5173
```

टेस्ट: `cd server && npm test` (in-memory MongoDB पर पूरा API टेस्ट)।

## API

| Method | Path | काम |
|---|---|---|
| GET | `/api/health` | सर्वर/DB स्टेटस |
| GET | `/api/summary` | कुल लेना, एडवांस, ग्राहक संख्या |
| GET | `/api/customers?search=&sort=balance\|recent\|name` | लिस्ट + बाक़ी |
| POST | `/api/customers` | `{ name, phone }` |
| GET / PATCH / DELETE | `/api/customers/:id` | ग्राहक + एंट्रियाँ / बदलें / हटाएँ |
| POST | `/api/customers/:id/transactions` | `{ type: "udhar"\|"jama", amount: "250.50", date, note }` |
| DELETE | `/api/transactions/:id` | एंट्री हटाएँ |
| GET | `/api/customers/:id/reminder` | मैसेज टेक्स्ट + WhatsApp/SMS लिंक |
| POST | `/api/customers/:id/reminder/send` | WhatsApp Cloud API से भेजें |

## डिप्लॉय (VPS)

`main` पर push होते ही GitHub Actions: टेस्ट → React build → VPS पर कॉपी → `deploy/remote-deploy.sh` चलाता है, जो
Node 22, Docker में MongoDB, systemd सर्विस, nginx और Let's Encrypt HTTPS सेट करता है और लिंक देता है:
`https://<VPS-IP-डैश-से>.sslip.io`

Repo → **Settings → Secrets and variables → Actions** में ये secrets डालें:

| Secret | उदाहरण |
|---|---|
| `VPS_HOST` | `72.60.110.25` |
| `VPS_USER` | `root` |
| `VPS_PASSWORD` | सर्वर का पासवर्ड (या `VPS_SSH_KEY` में private key) |

सर्वर पर सेटिंग्स: `/opt/udhar-khata/shared/.env` (दुकान का नाम, WhatsApp API टोकन) → बदलने के बाद `systemctl restart udhar-khata`।

### WhatsApp Cloud API चालू करना
1. Meta Business अकाउंट + WhatsApp Business API में नंबर जोड़ें।
2. Utility template बनाएँ, जैसे: `नमस्ते {{1}} जी, आपका ₹{{2}} बाक़ी है। कृपया जल्द भुगतान करें।`
3. `.env` में `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_TEMPLATE_NAME` भरें और सर्विस restart करें।
