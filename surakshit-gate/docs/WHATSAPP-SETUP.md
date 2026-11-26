# WhatsApp Cloud API चालू करना (असली मैसेज)

1. **Meta Business अकाउंट** (स्कूल/मालिक के नाम पर) → business verification।
2. **WhatsApp Business Platform** में स्कूल का नंबर जोड़ें (यह नंबर साधारण WhatsApp ऐप पर चालू नहीं होना चाहिए)।
3. **Utility टेम्पलेट** बनाएँ (भाषा: Hindi `hi`), नाम और वेरिएबल का क्रम यही रखें:

| टेम्पलेट | टेक्स्ट (उदाहरण) | वेरिएबल |
|---|---|---|
| `gate_arrival` | {{4}}: {{1}} (क्लास {{2}}) {{3}} पर स्कूल पहुँच गए हैं। | नाम, क्लास, समय, स्कूल |
| `gate_exit` | {{4}}: {{1}} (क्लास {{2}}) {{3}} पर स्कूल से निकल गए (माँ-बाप के साथ)। | नाम, क्लास, समय, स्कूल |
| `pickup_request` | ⚠ {{6}}: {{1}} आपके बच्चे {{2}} को लेने आए हैं। क्या बच्चे को भेजना है? फोटो देखकर हाँ/नहीं दबाएँ: {{3}} OTP: {{4}} ({{5}} मिनट तक) | लेने वाला, बच्चा, लिंक, OTP, मिनट, स्कूल |
| `pickup_done` | {{4}}: {{1}} को {{3}} पर {{2}} को सौंपा गया। | बच्चा, लेने वाला, समय, स्कूल |
| `gate_alert` | ⚠ {{2}}: {{1}} | संदेश, स्कूल |

4. **Webhook:** Callback URL `https://<डोमेन>/api/webhooks/whatsapp`, Verify token = `WA_VERIFY_TOKEN`; `messages` फ़ील्ड subscribe करें (भेजा/पहुँचा/पढ़ा/फ़ेल स्थिति यहीं से आती है)।
5. सर्वर पर `/opt/surakshit-gate/shared/.env`:
```
MESSAGE_PROVIDER=whatsapp
WA_TOKEN=<permanent system-user token>
WA_PHONE_NUMBER_ID=<phone number id>
WA_APP_SECRET=<app secret>        # webhook signature जाँच
WA_VERIFY_TOKEN=<अपना कोई भी लंबा शब्द>
```
फिर `systemctl restart surakshit-gate`।

नंबर WhatsApp पर नहीं है/बंद है (error 131026 आदि) → बच्चे के आगे “नंबर ⚠” + गार्ड की स्क्रीन पर चेतावनी + एडमिन अलर्ट।
