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
