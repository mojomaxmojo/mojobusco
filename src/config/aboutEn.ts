/**
 * aboutEn.ts – Statische englische Übersetzung der About-Konfiguration (Teil C)
 *
 * Teil C-Entscheidung: statische EN-Übersetzung, kein zweites Nostr-Event,
 * keine Live-Bearbeitung der englischen Version.
 *
 * Hat exakt dieselbe Struktur wie DEFAULT_ABOUT_DATA in src/config/about.ts
 * und wird angezeigt, sobald lang === 'en' ist (Verdrahtung in Schritt 4).
 * In Schritt 1 wird diese Datei von noch niemandem importiert.
 */

import type { AboutData } from '@/config/about';

export const EN_ABOUT_DATA: AboutData = {
  hero: {
    title: 'Home. Home everywhere.',
    subtitle:
      'For **{zeit}** no fixed residence. Instead countless sunsets, real encounters and a freedom you can’t buy – only live.',
  },

  sections: [
    {
      id: 'story',
      title: 'Our Story: The Day the Alarm Clock Fell Silent',
      topBar: 'from-primary via-accent to-primary',
      content: `It was a perfectly ordinary morning. The shrill, merciless ringing of the alarm clock cut through the silence at exactly 6:30 a.m. A sound that had paced our lives for years – trapped between calendars, obligations and the constant, quiet feeling of being in the wrong movie.

That morning we looked at each other. And we knew: it was the very last time.

On that day we didn't just switch off the alarm clock – we checked out of an entire system. Shortly afterwards Max turned the ignition key of our 10-meter MojoBus. The heavy US diesel engine came to life with a deep, vibrating rumble. Ahead of us lay the road. Behind us, what people commonly call "security".

Without a fixed destination. Without an endpoint. Just us, the road, the sea and the overwhelming feeling in our chests: we are finally awake.

Since then we live as perpetual travelers. Our everyday life is what we once only dreamed of during short vacation days. We usually camp right at the beach, live completely self-sufficiently with the power of the solar cells on our roof, minimalist and unbound. The wild roaring of the waves is our alarm clock, the horizon our daily panorama.`,
    },
    {
      id: 'leon',
      title: 'Leon (Lionhunter) – Our Eternal Co-Pilot',
      badge: '🐾🌈 In ewiger Erinnerung',
      cardBg: 'bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10',
      topBar: 'from-amber-500 to-orange-500',
      content: `To understand the story of the MojoBus, you have to hear about Leon. Our Rhodesian Ridgeback wasn't just a dog – he was the heartbeat of this bus, our "Soul Leon".

For over a decade he measured the world with us. He breathed the salty sea air at the cliffs, guarded us at every flat tire, dozed by the warm stove while the storm rattled the sheet metal outside, and made every beach his territory.

Recently Leon went on ahead of us. His physical place next to the driver's seat is now empty. And yet he travels with us in our hearts on every single kilometer we cover. His tracks in the sand of Europe's beaches may have been washed away by the water – but in our bus, in our thoughts and in every red sunset that sets the sky ablaze, he remains forever present. This journey was his. And it will remain so forever.`,
    },
    {
      id: 'nostr',
      title: 'Why We Write on Nostr (And Nowhere Else)',
      topBar: 'from-purple-500 via-blue-500 to-cyan-500',
      content: `We don't live free, self-sufficient and independent in real life only to let ourselves be chained to the whims of tech giants digitally.

We deliberately don't share our journey on the platforms of the big Silicon Valley corporations. We don't want algorithms throttling our reach, corporations selling our data, or censors deciding what you may and may not see.

Nostr is like our bus: decentralized, borderless and censorship-resistant.

Nostr belongs to no one – just like the road. There are no middlemen here. Only real people, real stories – direct, unadulterated and forever cryptographically anchored in the decentralized space. Those who want to follow us don't need an account with a data octopus. Just a Nostr client, a public key and the courage to think beyond the mainstream. ⚡🔑`,
    },
  ],

  pillars: [
    {
      id: 'freiheit',
      title: '🕊️ Freedom',
      content:
        'No boss, no calendar, no commuting in rush-hour traffic. Just the wind, quietly telling us where to head next.',
    },
    {
      id: 'abenteuer',
      title: '🔥 Adventure',
      content:
        'Every breakdown is the beginning of an unforgettable story. Every dead end leads us to places that are on no map.',
    },
    {
      id: 'autarkie',
      title: '☀️ Self-sufficiency',
      content:
        'The sun pays for our electricity. We have learned to live with little – and in doing so we own infinitely more.',
    },
  ],

  travelers: [
    {
      id: 'mojo',
      name: 'mojo',
      bio: `Navigating the 10-meter colossus through narrow cliff roads while the solar inverter hums quietly in the background – that's my comfort zone.

No fixed residence, no hamster wheel. I am the tech brain of our off-grid setup and a passionate advocate of digital and physical freedom. When I'm not servicing our US diesel or optimizing our solar-powered network, I lose myself in the endless expanses of Nostr and Bitcoin. For me, freedom is not a theoretical concept but a state you have to reclaim every day in both real and digital life. Our soul dog Leon is my eternal co-pilot in spirit.`,
      badges: ['#offgridlife', '#beachlife', '#vanlife', '#oceanview', '#btc'],
    },
    {
      id: 'susanne',
      name: 'SumSum',
      bio: `Freedom tastes like salt on the skin and smells like freshly brewed coffee on the lonely cliffs of Portugal.

I am Susanne (SumSum). I love pristine nature, the rough sea and the art of creating a real, warm home in the tightest of spaces. When we sold everything over a decade ago, I didn't just let go of my possessions but also of my doubts. I capture our journey in pictures and search in every new place for the real, deep moments. Our Rhodesian Ridgeback Leon (my "Soul Leon") taught me to live in the here and now – I carry this connection deep inside me on every beach walk.`,
      badges: ['#nature', '#beachlife', '#RVlife', '#oceanview', '#nostr'],
    },
  ],

  contact: {
    lightning: 'wiseboot30@zeusnuts.com',
    nip05: 'mojo@mojobus.co',
    emailLabel: 'Contact',
    emailValue: 'Via Nostr DM',
    websiteLabel: 'Website',
    websiteValue: 'mojobus.co',
  },

  seo: {
    title: 'About Us - MojoBus Perpetual Travelers Blog',
    description:
      'Meet Mojo and SumSum – perpetual travelers in the MojoBus. Our story, Leon and life in freedom.',
  },
};
