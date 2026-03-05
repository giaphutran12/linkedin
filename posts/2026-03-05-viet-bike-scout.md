there's no Kayak for motorbikes in Vietnam
so i built one

you want to rent a bike? open 20 tabs
check prices on 20 different shops
each with different layouts, currencies, and formats

none of these shops have an API
no aggregator existed 
just 200+ independent rental sites with ZERO standardization

ts drove me CRAZY
so i had to fix it myself

Viet Bike Scout scrapes 18 rental sites across 4 cities in parallel
using TinyFish Mino browser agents (it's like browseruse but better)

here's what it does:

1. pick your cities — HCMC, Hanoi, Da Nang, Nha Trang

2. it fires multiple browser agents to every rental shop at once
you can WATCH them work live in iframes on screen

3. results stream in real-time as each agent finishes
clickable links straight to the actual booking page
sortable by price or vehicle type

the whole thing takes about 5 minutes

every tourist in Vietnam rents a bike
and every one of them wastes hours comparing prices manually

that stops here

try it: viet-bike-scout.vercel.app

if you know someone planning a Vietnam trip, send this to them\

p/s: if you want your city on the list, just comment or dm me. i'll add that within 24 hours

Ave Christus Rex
