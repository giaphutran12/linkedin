i gave an AI ten different websites

and said "find me an appointment"

it did



not one website. ten. simultaneously

each with a completely different booking system

different UI, different platform, different everything



the AI navigated all of them



clicked through calendars, dismissed cookie popups

read availability pages

and came back with structured data

practitioner names, times, prices

clean JSON, ready to use



the API is called Mino



you send it any URL + a goal in plain english

it opens a real browser, figures out the site, and returns exactly what you asked for



so i built ClinicBook on top of it



pick a city, the service you want, and a date

then hit search



it fires 10 parallel Mino calls

streams results back in real time via SSE

and shows every available appointment across the city in one dashboard



no custom scrapers

no reverse engineering booking APIs

no Selenium scripts



one API call per clinic. that's it

the whole app took one sitting to build

the part that would've taken days — navigating 10 different websites — took zero lines of scraping code



Mino just... handled it



this is what building feels like when the hard parts disappear



follow if you like watching things get built Cliqk



Ave Christus Rex
