/**
 * NPC, dialogue and trade text. Dialogue text is keyed `dialogueText[dialogueId][nodeId]` = what they say, and
 * `choiceText[dialogueId][choiceId]` = the line the player picks (a choice id means the same everywhere in that dialogue).
 * The voice is the valley's: short, tired, practical.
 */
export const npcName: Record<string, { name: string; role: string }> = {
  odell: { name: 'Odell', role: 'Trader' },
  eli: { name: 'Eli', role: 'Survivor' },
  hollis: { name: 'Hollis', role: 'Farmer' },
  wren: { name: 'Wren', role: 'Ranger' },
  tobin: { name: 'Tobin', role: 'Fisherman' },
};

export const dialogueText: Record<string, Record<string, string>> = {
  odell: {
    first: 'Hands where I can see them. Good. Gate rules: no shooting, no biting, no haggling after dark. I buy what is useful and sell what I can spare.',
    who: 'Odell. I was a quartermaster before this. Now I keep the books for a gate nobody guards, and I am very good at it.',
    hub: 'What do you need?',
    news: 'Relay Seven is still on the air, if you have a radio. Route Nine has fuel, slowly. Maple Street has people who will not open the door. The crash site is worth the walk, if you can walk it.',
    prices: 'I pay about what a thing is worth to me, and you pay about what it is worth to you. The difference is the roof over my head. My till is empty by evening; come back tomorrow with more.',
  },
  eli: {
    first: 'Stay on the porch. Please. My friend Danny is inside with a fever and I am out of everything. Do you have anything for him?',
    about: 'Danny is the same. Hot, then cold. I do not like how he breathes.',
    danny: 'He got a cough two days ago, a wet one. I thought it was a cold. It is not a cold. There is a cabinet in the house two doors down, the one with the green door. I have not been brave enough to go.',
    where: 'Second house down, bathroom cabinet at the back. Antibiotics, if the people before us left any. Bring them here. I cannot leave him.',
    waiting: 'Have you found them yet? Second house down, bathroom cabinet. Please hurry.',
    pills: 'Those are the right pills. Please tell me those are the right pills.',
    thanks: 'Thank you. I do not know your name and I do not need to. Whatever you need from this street, take it. Danny will see morning.',
    after: 'He is sleeping. His breathing is easier. Thank you. I mean it every time I say it.',
  },
  hollis: {
    first: 'Easy. I have a shovel and I know how to use it, but I would rather not. You look hungry. Everyone looks hungry.',
    hub: 'What is it?',
    food: 'Here. Two tins of corn from the cellar. Do not tell anyone I gave you the good ones.',
    rags: 'Rags. Real cloth. I will take that trade. Two tins of tuna, and we call it even.',
    fire: 'Lay the fire in the open, upwind, with a pot over it. Boil everything. Dirty water kills quieter than the dead do. And keep the planks dry; they burn better.',
  },
  wren: {
    first: 'You made it up the ridge. Most people turn back at the second switchback. I am Wren. I watch the valley.',
    hub: 'What can I tell you?',
    relay: 'The relay at the base of the tower carries a radio signal over the hills. It only needs somebody on the platform to speak. If you have a radio, use it up here. Say anything.',
    valley: 'From here: eleven fires. The farm, the camp, the diner. Maple Street keeps one on the porch. The checkpoint never goes out. Everything else is dark, and dark is where they are.',
    light: 'Take these. Glow sticks. Mark a door you have cleared, so the next person knows it is safe to open.',
  },
  tobin: {
    first: 'Stop there, by the fire ring. They do not come out on the dock, so that is where I sleep. I am Tobin. My ankle is no good, or I would not be sitting here talking to strangers.',
    hub: 'Fish are biting. Nothing else is, if you are quiet.',
    dee: 'Dee went to Camp Harlan. The army came on the scanner saying convoy, evacuation, medics. Dee is a nurse; of course Dee went. The scanner lost the army channel the next night. The crystal cracked.',
    where: 'There is a spare crystal in the camp office, in the desk. Little tin can, says HARLAN on the lid. I cannot make the walk up the bank on this ankle. Bring it and I will listen for them.',
    waiting: 'The office desk. A little tin can. I will keep the fire going.',
    crystal: 'That is it. That is the one. Give it here, gently.',
    listened: 'Static, then a voice. I got most of it. I wrote it all down in cabin A, on the nightstand; my hands shake too much to read it twice. Camp Harlan. Go and see. Please.',
    harlan: 'Anything from Harlan? I keep the scanner on. It only says the same thing over and over.',
    letter: "That is Dee's handwriting on the envelope. Read it to me? No. Give it here. I will read it myself.",
    letter_read: 'North with the convoy. Alive, at least on the day this was written. And Dee left me the manual, as if I could learn it. You take it. You are the one walking around out there. Learn the trauma kit. Use it on people.',
    after: 'I am staying at the lake. If Dee comes back, this is where Dee will look. Thank you for walking it for me.',
    fish: 'Worms in the cooler, line on the rack. Cast past the reeds. If the water goes flat and quiet, reel in and walk away slowly.',
  },
};

export const choiceText: Record<string, Record<string, string>> = {
  odell: {
    who: 'Who are you?',
    trade: 'Let us trade.',
    news: 'Any news?',
    prices: 'How do your prices work?',
    back: 'Another question.',
    leave: 'Never mind.',
  },
  eli: {
    danny: 'Who is Danny?',
    where: 'Where is the medicine?',
    give: 'Here. I found antibiotics.',
    later: 'Hold on, I will be right back.',
    leave: 'I will see what I can find.',
  },
  hollis: {
    hi: 'I mean no harm.',
    food: 'Could you spare some food?',
    rags: 'I have rags. Will you trade for them? (3 rags)',
    fire: 'Any advice for the night?',
    back: 'Another question.',
    leave: 'Take care.',
  },
  wren: {
    hi: 'I made it. Barely.',
    relay: 'What is the relay?',
    valley: 'What do you see from up here?',
    light: 'Could I borrow some light?',
    back: 'Another question.',
    leave: 'I should go.',
  },
  tobin: {
    who: 'Who is Dee?',
    where: 'How can I help?',
    give: 'Here. The crystal from the office.',
    letter: 'I found a letter at Camp Harlan.',
    later: 'Not yet. I will be back.',
    fish: 'How is the fishing?',
    back: 'Another question.',
    leave: 'Stay safe on the dock.',
  },
};

export const npcUi = {
  talk: (name: string) => `Talk to ${name}`,
  trade: (name: string) => `Trade with ${name}`,
  leave: 'Leave',
  hint: '1-4 or click to answer · Esc to leave',
  got: (name: string, n: number) => `+ ${name}${n > 1 ? ` ×${n}` : ''}`,
  gave: (name: string, n: number) => `- ${name}${n > 1 ? ` ×${n}` : ''}`,
};

export const tradeUi = {
  title: 'Trade',
  stock: 'For sale',
  yours: 'Your pack',
  cash: 'Your cash',
  till: 'Odell will pay today',
  buy: 'Buy',
  sell: 'Sell',
  sellAll: 'Sell all',
  empty: 'Nothing for sale right now.',
  nothingToSell: 'Nothing he wants.',
  hint: 'Esc closes · prices include his margin',
  bought: (name: string, n: number, price: number) => `Bought ${name}${n > 1 ? ` ×${n}` : ''} for $${price}`,
  sold: (name: string, n: number, price: number) => `Sold ${name}${n > 1 ? ` ×${n}` : ''} for $${price}`,
  reasons: {
    funds: 'Not enough cash',
    trader_cash: 'He is out of cash for today',
    stock: 'Sold out',
    worthless: 'He has no use for that',
    not_carried: 'You are not carrying that',
    holds_items: 'Empty it first',
  } as Record<string, string>,
};
