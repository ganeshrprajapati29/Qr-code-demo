> **इस repo में दो प्रोजेक्ट हैं:** ① उधार खाता + QR स्कैनर (यह फ़ोल्डर) · ② [सुरक्षित गेट — स्कूल QR आईडी कार्ड और सुरक्षित पिकअप](surakshit-gate/README.md) (`surakshit-gate/`)

# दुकान का उधार खाता (Udhar Khata)

फ़ोन पर चलने वाला वेब ऐप जिसमें **फ़ोन के कैमरा से QR स्कैन करके नाम दिखता है**, और दुकानदार अपने ग्राहकों का **उधार** और **जमा** लिखता है, हर ग्राहक का **कुल बाक़ी** अपने आप देखता है, और एक बटन से **WhatsApp / SMS** पर याद दिलाता है।

**Stack:** Node.js + Express 5 · MongoDB (Mongoose) · React 19 + Vite · nginx + Let's Encrypt (HTTPS) · one-command isolated installer · GitHub Actions CI

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

### QR स्कैनर (पहला पेड टेस्ट: “फ़ोन का कैमरा QR स्कैन करके एक नाम दिखाए”)

| फ़ीचर | कैसे |
|---|---|
| कैमरा से स्कैन | नीचे “QR स्कैन” टैब → “कैमरा चालू करें” (पीछे वाला कैमरा) → QR दिखाते ही नाम बड़ा दिखता है |
| ग्राहक का QR कार्ड | हर ग्राहक का अपना QR कार्ड (ग्राहक पेज → “QR कार्ड”) — डाउनलोड/शेयर/प्रिंट। स्कैन करते ही ग्राहक का **नाम + बाक़ी** और “खाता खोलें” |
| फ़ोन के कैमरा ऐप से | कार्ड में लिंक `https://…/c/<token>` है — फ़ोन का साधारण कैमरा ऐप भी सीधे खाता खोल देता है |
| कोई भी नाम वाला QR | सादा टेक्स्ट, `{"name":"…"}`, `name: …` या vCard — नाम निकालकर दिखाता है |
| फ़ोटो से स्कैन | कैमरा न चले तो गैलरी की फ़ोटो से |
| स्कैन हिस्ट्री | हर स्कैन सर्वर पर सेव (90 दिन) — “हाल के स्कैन” |
| टेस्ट QR बनाना | स्कैन पेज पर किसी भी नाम का QR बनाकर टेस्ट करें |
| सुरक्षा | कार्ड में DB ID नहीं, रैंडम टोकन; कार्ड खो जाए तो “नया QR बनाएँ” से पुराना बंद |

कैमरा सिर्फ़ **HTTPS** लिंक पर चलता है — installer अपने आप Let's Encrypt सर्टिफ़िकेट लगाता है।

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
| VPS (पहले से मौजूद VPS पर) | ₹0 अतिरिक्त (~300 MB RAM) · अलग से लें तो ~₹400–800/माह (1–2 GB RAM) |
| MongoDB | ₹0 (उसी VPS पर, अलग प्रोसेस) |
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

टेस्ट: `cd server && npm test` — 13 टेस्ट (in-memory MongoDB पर पूरा API, QR, माइग्रेशन, सर्वर बूट)।

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
| POST | `/api/customers/:id/qr/regenerate` | ग्राहक का नया QR टोकन (पुराना कार्ड बंद) |
| POST | `/api/qr/resolve` | `{ code }` → `{ kind: "customer"\|"text"\|"link", name, customer }` + स्कैन लॉग |
| GET / DELETE | `/api/qr/scans` | हाल के स्कैन / हिस्ट्री मिटाएँ |

## डिप्लॉय (VPS) — एक कमांड

VPS पर root से login करके बस ये चलाएँ:

```bash
curl -fsSL https://raw.githubusercontent.com/ganeshrprajapati29/Qr-code-demo/main/deploy/install.sh | bash
```

5–8 मिनट में लिंक मिल जाएगा: `https://<VPS-IP-डैश-से>.sslip.io` (जैसे `https://72-60-110-25.sslip.io`)।
अपडेट के लिए वही कमांड दोबारा चलाएँ — डेटा और सेटिंग्स बनी रहती हैं।

**सर्वर के बाक़ी प्रोजेक्ट्स पर असर नहीं पड़ता:**
- सब कुछ `/opt/udhar-khata` में — अपना Node.js और अपना MongoDB (सिस्टम का Node/Mongo/Docker न इंस्टॉल होता है न बदलता है)
- MongoDB सिर्फ़ `127.0.0.1:27027` पर, RAM सीमित (Mongo 700 MB, ऐप 400 MB)
- अलग Linux user `udharkhata` और अलग systemd सर्विस `udhar-khata`, `udhar-khata-mongo`
- nginx में सिर्फ़ इसी sslip.io डोमेन की एक नई फ़ाइल; `nginx -t` फ़ेल हो तो फ़ाइल हटा दी जाती है
- पोर्ट 80 किसी और प्रोग्राम (Apache, Caddy, Docker) के पास हो तो उसे छुआ नहीं जाता — ऐप अपने पोर्ट पर चलता है: `http://<ip>.sslip.io:5055`
- HTTPS: Let's Encrypt (certbot, न चले तो acme.sh) — सिर्फ़ इसी डोमेन के लिए

| काम | कमांड |
|---|---|
| लॉग देखें | `journalctl -u udhar-khata -f` |
| सेटिंग्स (दुकान का नाम, WhatsApp टोकन) | `nano /opt/udhar-khata/shared/.env` फिर `systemctl restart udhar-khata` |
| पूरी तरह हटाएँ | `bash /opt/udhar-khata/app/deploy/uninstall.sh` |

ऑटो-डिप्लॉय (वैकल्पिक): repo secrets `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD` (या `VPS_SSH_KEY`) डालें — हर push पर GitHub Actions यही installer चलाएगा।

### WhatsApp Cloud API चालू करना
1. Meta Business अकाउंट + WhatsApp Business API में नंबर जोड़ें।
2. Utility template बनाएँ, जैसे: `नमस्ते {{1}} जी, आपका ₹{{2}} बाक़ी है। कृपया जल्द भुगतान करें।`
3. `.env` में `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_TEMPLATE_NAME` भरें और `systemctl restart udhar-khata`।
