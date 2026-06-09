# PantryPulse — Planificator de Cumpărături Premium

PantryPulse este o aplicație web modernă, rapidă și complet receptivă (responsive), creată pentru a-ți planifica și organiza lista de cumpărături direct de pe telefon sau desktop.

## 🚀 Caracteristici
* **Adăugare rapidă**: Adaugă denumirea alimentului, cantitatea dorită (cu suport pentru zecimale, de ex. `0.5`), unitatea de măsură (bucăți, kg, grame, litri, baxuri, pachete) și furnizorul.
* **Autocomplete inteligent**: Câmpul de furnizori (Lidl, Penny, Carrefour etc.) se autocompletează pe măsură ce tastezi și învață automat furnizorii noi pe care îi introduci.
* **Editare & Ștergere în timp real**: Permite modificarea rapidă a oricărui produs existent direct în formular sau eliminarea acestuia.
* **Filtrare & Căutare**: Filtrează rapid produsele (Toate, De cumpărat, Cumpărate) și folosește bara de căutare pentru filtrare după nume sau magazin.
* **Statistici dinamice**: Monitorizează în timp real progresul cumpărăturilor tale.
* **Persistență locală**: Toate datele sunt salvate în `localStorage`, asigurând că lista rămâne salvată chiar și după închiderea browserului.
* **Interfață Premium Light Mode**: Design minimalist și aerisit, cu efecte de sticlă (glassmorphism) și animații fluide.

## 🛠️ Tehnologii folosite
* **HTML5** (semantic structure & native autocomplete datalist)
* **CSS3** (responsive grid, Flexbox, custom variables, micro-animations, glassmorphism)
* **JavaScript (Vanilla)** (client-side state management, DOM manipulation, localStorage integration)

## 💻 Cum se rulează local
Deoarece este o aplicație statică, nu necesită un proces complex de instalare. 

1. Descarcă fișierele proiectului.
2. Deschide fișierul `index.html` direct în orice browser modern.
3. *Alternativ*, poți porni un server local (de exemplu, folosind Node.js sau Python):
   ```bash
   # Cu Node.js
   npx http-server -p 8000
   
   # Sau cu Python
   python -m http.server 8000
   ```
   Apoi accesează `http://localhost:8000`.
