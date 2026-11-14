export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  guild_id?: string;
  position?: number;
  recipients?: DiscordUser[];
  last_message_id?: string;
}

export interface DiscordRelationship {
  id: string;
  type: number;
  nickname?: string | null;
  user: DiscordUser & {
    global_name?: string | null;
    display_name?: string | null;
  };
}

export type TabType = 'channels' | 'normal' | 'mass-dm' | 'gc-changer' | 'wl-gen' | 'autobeefer' | 'legit' | 'song' | 'options' | 'auto-reply' | 'afk-check' | 'delete-messages' | 'robber' | 'anti-afk' | 'about-me' | 'force-nickname';

export const STARTERS = ['LISTEN HERE', 'GET LOST', 'KEEP QUIET', 'GO AWAY', 'STAY DOWN', 'BE GONE', 'HUSH UP', 'GET OUTTA HERE', 'SCRAM', 'SHUSH', 'BACK OFF', 'STEP ASIDE', 'ZIP IT', 'DISAPPEAR', 'VANISH', 'SKEDADDLE', 'SHUT IT', 'MOVE ALONG', 'PIPE DOWN', 'CLEAR OUT', 'TAKE A HIKE', 'GET GONE', 'BEAT IT', 'VAMOOSE', 'GET LOST FOREVER'];
export const MODIFIERS = ['FUCKIN', 'HOE ASS', 'BITCH ASS', 'LAME ASS', 'DUMB ASS', 'WEAK ASS', 'SLOW ASS', 'TRASH ASS', 'SHITTY', 'RETARDED', 'CLOWN ASS', 'BROKE ASS', 'USELESS', 'FAGGOT', 'PUNK ASS', 'CRAPPY', 'JUNK ASS', 'WORTHLESS', 'STINKY', 'ASS', 'MESSED UP', 'GARBAGE', 'PATHETIC ASS', 'NO GOOD', 'DIRTY ASS'];
export const DESCRIPTORS = ['LITTLE', 'PATHETIC', 'WORTHLESS', 'STUPID', 'UGLY', 'DICKLESS', 'BRAINLESS', 'FAT', 'LAME', 'INFERIOR', 'DISGUSTING', 'SMELLY', 'DIRTY', 'HOPELESS', 'LOWLIFE', 'SCRAWNY', 'PUNY', 'MISERABLE', 'SCARY', 'DETESTABLE', 'REVOLTING', 'GROTESQUE', 'ABHORRENT', 'VILE', 'NASTY'];
export const NOUNS = ['BITCH', 'LOSER', 'DORK', 'NERD', 'PUSSY', 'CUNT', 'WHORE', 'SLUT', 'FAG', 'IDIOT', 'DUMMY', 'RETARD', 'CLOWN', 'LAME', 'SNITCH', 'TRICK', 'CHUMP', 'NEET', 'FAILURE', 'SCUM', 'WEIRDO', 'CREEP', 'JACKASS', 'MORON', 'DOPE'];
export const VERBS = ['CLOWNING', 'WHINING', 'SUCKING', 'FAILING', 'STINKING', 'SHOUTING', 'SHITTING', 'SHOOTING', 'SHUTTING', 'HATING', 'CRAPPING', 'KEEPING', 'SLEEPING', 'DEEPING', 'DROWNING', 'SKIPPING', 'TRIPPING', 'WALKING', 'WALLING', 'GALLING', 'BLUNDERING', 'FUMBLING', 'STUMBLING', 'BUMBLING', 'RAMBLING'];
export const INTENSIFIERS = ['AS FUCK', 'AS HELL', 'TOO DAMN MUCH', 'FOREVER', 'INSANELY', 'WAY TOO', 'SO DAMN', 'UP', 'SO', 'WAY', 'BEYOND BELIEF', 'OUTRAGEOUSLY', 'TOTALLY', 'COMPLETELY', 'ABSOLUTELY'];
export const TAUNTS = ['END YOURSELF', 'CRY HARDER', 'DIE NOW', 'KYS', 'GET LOST', 'GIVE UP', 'KEEP OUT', 'STAY OUT', 'GET OUT', 'JUMP OFF', 'NOW', 'VAPORIZE', 'VANISH NOW', 'QUIT', 'SCAT', 'CLEAR', 'UPPER', 'EAT DIRT', 'CHOKE', 'FLOP', 'GET WRECKED', 'GO HOME', 'DROP DEAD', 'SINK', 'FAIL OUT'];
export const EXTRAS = ['I DONT RATE U', 'UR A JOKE', 'U AINT SHIT', 'UR WORTHLESS', 'NOBODY RESPECTS U', 'U CANT COMPETE', 'UR A MESS', 'U GOT NO ZIP', 'UR A WASTE', 'U MAKE ME SICK', 'U NO VALUE', 'UR DONE FOR', 'U AINT WORTH SPIT', 'U SMELL LIKE TRASH', 'U AINT GOT NO BALLS', 'UR A DISGRACE', 'U GOT NO CLASS', 'UR A NOBODY', 'U CANT HANG', 'UR A FRAUD', 'U AINT GOT NO SKILL', 'UR LIFE’S A LIE', 'U GOT NO FUTURE', 'UR A BUM', 'U AINT WORTH DUST'];
export const CLOSERS = ['SHUT THE FUCK UP', 'SLOW', 'QUIT', 'NOW', 'CUCK', 'SHITTY', 'BACKUP', 'STEPSIDE', 'OUT', 'NO', 'DIE', 'NOWAY', 'LOSER', 'FAGGOT', 'SHOVE OFF', 'GET OUTTA MY FACE', 'ZIP UP', 'SHUT UP NOW', 'GONE'];
