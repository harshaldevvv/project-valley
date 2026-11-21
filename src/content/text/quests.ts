/**
 * Quest text (data/quests.ts ids): titles, one-line summaries, an objective line per objective (same order), a
 * completion line, and the notes found at places. The voice is the valley's: tired, practical, never cheerful.
 */
export interface QuestText {
  title: string;
  summary: string;
  /** One line per objective, in order. */
  objectives: string[];
  done: string;
}

export const questText: Record<string, QuestText> = {
  wake: {
    title: 'Wake Up',
    summary: 'You are in the yard behind the wall. It is quiet. Quiet is when you check your kit.',
    objectives: ['Switch on your flashlight (hotbar 8, or press L)'],
    done: 'Light works. Somebody left a radio on the bench; it is yours now.',
  },
  listen: {
    title: 'Check the Radio',
    summary: 'The radio crackles. Somebody out there is still talking.',
    objectives: ['Use the radio (right-click it in your pack, Use)'],
    done: 'Relay Seven. Fuel at Route 9, if you are willing to walk. Take this can.',
  },
  make_do: {
    title: 'Make Do',
    summary: 'Nobody is coming with supplies. Rags and tape are supplies if you ask nicely.',
    objectives: ['Craft a bandage from rags (G opens crafting)'],
    done: 'Clean, tight, tied off. A pot and some soup for the road.',
  },
  route9: {
    title: 'Route 9 Fuel Stop',
    summary: 'The pumps are slow but not dry. The truck has been waiting for a reason to move.',
    objectives: ['Go to the Route 9 Fuel Stop', 'Fill your jerrycan at a pump (hold E; carry at least 12 L)', 'Pour it into the truck (stand at the back, hold E)'],
    done: 'The needle moves. Take the repair kit from the garage, and the cash from the till; nobody is counting.',
  },
  maple: {
    title: 'Maple Street',
    summary: 'A note on a nightstand: somebody is sick, and the only cure is in a bathroom cabinet two houses down.',
    objectives: ['Go to Maple Street', 'Read the note in the house', 'Find antibiotics (the second house, bathroom cabinet)', 'Bring the antibiotics to Eli on the porch'],
    done: 'Eli takes the pills like they might vanish. Danny will see morning. Take the kit; it is not much, but it is all he has.',
  },
  farm: {
    title: 'Hollow Creek Farm',
    summary: 'Half the valley ate from these fields. Tonight you eat from a pot, the way people used to.',
    objectives: ['Go to Hollow Creek Farm', 'Craft a campfire kit', 'Light the fire (a lighter, a match or a torch)', 'Heat a can of soup at the fire (needs the pot)', 'Eat the hot soup'],
    done: 'Warm all the way down. The farm is quiet enough to hear the fire.',
  },
  school: {
    title: 'Westside School',
    summary: 'The bus never left. The children did. Somebody wrote a list.',
    objectives: ['Go to Westside School', 'Read the register in the office'],
    done: 'Forty names, thirty-one ticked. You pack a school bag for whoever comes next.',
  },
  camp: {
    title: 'Pinewood Camp',
    summary: 'Campers came to wait it out. One of them kept a diary, and it stops mid-sentence.',
    objectives: ['Go to Pinewood Camp', 'Read the diary in the stash', 'Wait out an hour and a half at the camp (keep warm, keep quiet)'],
    done: 'Nothing found you. That is the best review a campsite can get.',
  },
  crash: {
    title: 'Medevac Crash Site',
    summary: 'It went down carrying the cure, or so the radio said. The crew logged every minute of the descent.',
    objectives: ['Go to the Medevac Crash Site', 'Read the flight log', 'Clear the crash site (4 kills)', 'Find the adrenaline in the pharmacy shelf'],
    done: 'There was no cure. There were supplies, and a pilot who kept the log going to the end. Take what is useful.',
  },
  ranger: {
    title: 'Ranger Ridge',
    summary: 'The highest vantage in the valley. The log says the relay station only needs one more signal.',
    objectives: ['Go to Ranger Ridge', 'Read the ranger log', 'Use the radio at the lookout'],
    done: 'Seen from here, the valley is smaller. Relay Seven hears you now, and that is the end of the beginning.',
  },
  lake_dock: {
    title: 'The Dock at Loon Lake',
    summary: 'A fisherman sleeps on the dock because the dead will not follow him onto the water. He is waiting for a voice on the scanner.',
    objectives: ['Go to Loon Lake Campground', 'Find the scanner crystal (camp office desk)', 'Bring the crystal to Tobin by the east fire ring'],
    done: 'The scanner hisses back to life. Tobin presses it to his ear and waves you off. Take the fish; he has more than he can eat.',
  },
  harlan_static: {
    title: 'Static from Camp Harlan',
    summary: 'Tobin heard the army channel and wrote down every word. The words point east, to the outpost past the farm.',
    objectives: ['Read the scanner transcript (rental cabin A, nightstand)', 'Go to Camp Harlan', 'Use the radio inside the camp fence'],
    done: 'The outpost is still broadcasting on a loop. Convoy gone north, medics with it. The garrison stayed behind, and still walks the fence.',
  },
  harlan_clear: {
    title: 'Clear Camp Harlan',
    summary: 'Whatever Dee left behind is inside the wire, and so is the garrison. Thin it out, then search the camp.',
    objectives: ['Clear Camp Harlan (8 kills)', 'Find the letter in the supply crate and read it', 'Bring the letter to Tobin at Loon Lake'],
    done: "Tobin reads the letter twice, then hands you a manual with a nurse's notes in the margins. Carry it and you can build trauma kits (IFAK) at the crafting menu.",
  },
};

/** Fallback shown if a quest has no text yet. */
export const questFallback: QuestText = { title: 'Unnamed task', summary: '', objectives: [], done: '' };

/** Notes: a title and a body under 120 words, by item id. */
export const noteText: Record<string, { title: string; body: string }> = {
  note_maple_sick: {
    title: 'Note on the nightstand',
    body: 'Danny has a fever and the cough is wet now. The cabinet in my brother\'s house, the green one at the back, has antibiotics. I went to get them and I have not come back, so if you are reading this: please. Bring them to Eli on the porch, he will not open the door for anyone else. Danny is too weak to go to the door. Do not knock hard.',
  },
  note_school_roll: {
    title: 'Evacuation register',
    body: 'Forty names. Thirty-one ticked. The buses left at six; one did not. Nobody wants to be the person who writes what happened to the other nine. If you find a school bag with a name on it, that name is one of them. Please do not read it out loud.',
  },
  note_camp_diary: {
    title: 'Camp diary, last page',
    body: 'Day nine. The fire keeps them away if you keep it going all night, so we take shifts. I take the third one. Marcus snores, which helps: a sound you know is a sound that is not them. I am going to write down the plan for tomorrow, and the plan is, we stay. We stay',
  },
  note_crash_log: {
    title: 'Medevac flight log',
    body: '02:14 Lost the rear rotor. 02:15 Altitude gone. 02:16 Cargo is sealed and secured. If this is found: the cargo is NOT a cure. It never was. It is a trial dose and some paperwork. Whoever promised otherwise on the radio, we did not. Take the medical kit from the shelf. Use it on people.',
  },
  note_ranger_log: {
    title: 'Ranger log, tower six',
    body: 'From up here you see the whole valley and every fire in it. I count eleven. One of them is yours. The relay at the base of the tower only needs a clear signal to carry past the hills. If you have a radio, use it from the platform. Say anything. Somebody in the next valley is listening and has been for weeks.',
  },
  note_lake_scanner: {
    title: 'Scanner transcript',
    body: 'Army channel, 21:40. "Camp Harlan to all stations. Convoy departs north at dawn. Medical staff travel with the convoy. Civilians, do not approach the fence after dark." Then a different voice, close to the mic: "Tobin, if this reaches the lake, I left something for you in the supply crate." Then static. It was Dee. I know it was Dee. Harlan is east, past the farm. Take a radio and listen there yourself.',
  },
  note_harlan_medic: {
    title: 'Letter for Tobin',
    body: 'Tobin. The convoy is leaving and I am going with it; they need every nurse they have. Do not come after me. The garrison is not right anymore, and they will not stay behind the fence much longer. I am leaving you my field manual. You always asked how I packed a trauma kit so fast. Page forty. A clean dressing, a tourniquet, antiseptic, rolled tight. Learn it, then teach it to someone. Keep the fire small. Dee.',
  },
  field_manual: {
    title: 'Combat medic field manual, page 40',
    body: 'Individual first aid kit (IFAK), field assembly: one sterile dressing, one tourniquet, one antiseptic. Fold the dressing flat, stage the tourniquet on top, tape the pouch shut so it opens one-handed. In the margin, in pencil: Dee says practise until you can do it in the dark. Carry this manual and the crafting menu will show you how.',
  },
};

export const questUi = {
  tracker: 'Quest',
  journal: 'Journal',
  active: 'Active',
  done: 'Completed',
  notes: 'Notes',
  track: 'Track',
  tracked: 'Tracking',
  reward: 'Reward',
  side: 'Side',
  none: 'Nothing here yet.',
  hint: 'J close · click a quest to read it, Track to follow it',
  newQuest: (t: string) => `New: ${t}`,
  progress: (done: number, total: number) => `${done}/${total}`,
  complete: (t: string) => `Quest complete: ${t}`,
  step: (t: string) => `✓ ${t}`,
  read: 'Read',
  meters: (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`),
  dir: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  rewardGiven: (name: string, n: number) => `+ ${name}${n > 1 ? ` ×${n}` : ''}`,
  /** The pack was full: the reward is on the ground at the player's feet. */
  rewardDropped: (name: string, n: number) => `+ ${name}${n > 1 ? ` ×${n}` : ''}: no room, left at your feet`,
};
