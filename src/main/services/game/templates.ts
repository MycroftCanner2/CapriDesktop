import { GameEventType } from './types'

export interface ReactionTemplateSet {
  es: string[]
  en: string[]
}

export const GAME_REACTION_TEMPLATES: Record<GameEventType, ReactionTemplateSet> = {
  player_died: {
    es: [
      '¡Uff, friend! Nos reiniciaron el sistema. Respawn y nos vengamos.',
      '¡Maldición! Te borraron el ciberware. ¡La próxima los freímos, {name}!',
      'Ouch... no lo vimos venir, {name}. Recuperate y vamos de nuevo.',
      '¡Al suelo, friend! Mantené la calma, todavía tenemos cromo de sobra.',
      '¡Nos mandaron al desarmadero! A levantarse con furia, {name}.',
      'Tranqui, friend. Reajustando ciberware para el segundo round.'
    ],
    en: [
      'Ouch, friend! Reboot and let\'s get some payback!',
      'Damn, they fried our ICE! We will zero them next time, {name}.',
      'Down in the dirt! Shake it off, {name}, we are not done.',
      'System reboot! Keep your chrome cool, friend.',
      'Flatlined! Dust yourself off, {name}, round two is ours.',
      'Recalibrating cyberware, friend. Next push is ours.'
    ]
  },

  player_kill: {
    es: [
      '¡Al piso! ¡Hermosa kill, friend!',
      '¡Uno menos en el mapa! ¡Así se hace, {name}!',
      '¡Ciberware frito! Sos una máquina letal, friend.',
      '¡A dormir! Impecable disparo, {name}.',
      '¡Sparks flying! ¡Ese no se levanta más!',
      '¡Lo borraste del mapa, friend! ¡Seguí así!'
    ],
    en: [
      'Flatlined! Beautiful kill, friend!',
      'One less scrub on the grid! Nice shot, {name}!',
      'Fried their neural link! You are lethal today, friend.',
      'Straight to the scrapheap! Great work, {name}.',
      'Sparks flying! That one is staying down.',
      'Clean elimination, {name}! Keep that momentum!'
    ]
  },

  multikill: {
    es: [
      '¡Doble kill! ¡Estás afiladísimo, {name}!',
      '¡Triple kill! ¡Qué masacre en el ciberespacio, friend!',
      '¡Cuádruple! ¡Están corriendo de miedo, {name}!',
      '¡PENTAKILL! ¡Sos una bestia legendaria, {name}! ¡Qué locura!'
    ],
    en: [
      'Double kill! Slicing through chrome like butter, {name}!',
      'Triple kill! Total carnage, friend!',
      'Quadra kill! They are terrified of you, {name}!',
      'PENTAKILL! Absolutely legendary, {name}! You wiped the floor!'
    ]
  },

  combat_started: {
    es: [
      '¡Entrando en combate! ¡Armas listas, friend!',
      '¡Se picó la cosa! ¡A cubierto y fuego cruzado, {name}!',
      '¡Contacto hostil detectado! Hacelos volar en pedazos.'
    ],
    en: [
      'Combat engaged! Keep your chrome ready, friend!',
      'Hostiles in range! Let us make some sparks, {name}!',
      'Weapons hot! Blow them to pieces, friend.'
    ]
  },

  combat_ended: {
    es: [
      'Zona despejada. Buen laburo, friend.',
      'Silencio en el sector. Respirá tranquilo, {name}.',
      'Amenazas neutralizadas. A saquear lo que quedó.'
    ],
    en: [
      'Sector clear. Clean work, friend.',
      'Threats neutralized. Take a breather, {name}.',
      'Combat resolved. Let us scavenge what is left, friend.'
    ]
  },

  low_health: {
    es: [
      '¡Ojo la vida, {name}! ¡Buscá cobertura ya!',
      '¡Estás en las últimas, friend! ¡Curate o nos desconectan!',
      '¡Chasis en rojo! ¡Retrocedé unos metros, {name}!'
    ],
    en: [
      'Watch your health, {name}! Find cover right now!',
      'Critical damage! Heal up before they flatline us, friend!',
      'Rig redlining! Pull back a few meters, {name}!'
    ]
  },

  champion_picked: {
    es: [
      'Ese pick tiene tremenda facha. ¡Vamos con todo, {name}!',
      'Buena elección de campeón, friend. A dominar la línea.'
    ],
    en: [
      'Solid champion pick, {name}! Let us dominate the lane.',
      'Looking lethal with that champion, friend. Ready up!'
    ]
  },

  enemy_team_known: {
    es: [
      'Composición enemiga escaneada en el ciberware. Ojo a sus flancos.',
      'Equipo rival identificado. Preparando contramedidas tácticas, {name}.'
    ],
    en: [
      'Enemy roster scanned in my rig. Watch their flanks, {name}.',
      'Opposing crew identified. Calibrating tactical countermeasures, friend.'
    ]
  },

  implant_changed: {
    es: [
      'Nuevo cromo en el chasis. Sentí esa potencia, {name}.',
      'Actualización neuronal completada. ¡Qué facha ese implante, friend!'
    ],
    en: [
      'New chrome installed. Feel that raw power, {name}!',
      'Neural upgrade locked in. Looking lethal, friend!'
    ]
  },

  wanted_level: {
    es: [
      '¡Ojo con el NCPD, friend! Están cerrando el perímetro. ¡Pisa a fondo!',
      '¡Alerta de calor! Los patrulleros vienen con todo, {name}. ¡A perderlos por los callejones!',
      '¡Sirenas en el radar! Si cae MaxTac se pudre todo, friend. ¡Buscá cobertura ya!'
    ],
    en: [
      'NCPD sirens wailing! Shake the badges off our tail, friend!',
      'Heat level rising, {name}! Drop the cops before MaxTac rolls in!',
      'Scanner redlined with cruisers! Floor it and dive into the alleys, friend!'
    ]
  },

  district_entered: {
    es: [
      'Entrando al sector {district}. Mantené un ojo en el retrovisor y el fierro caliente, friend.',
      'Cruzando el límite de {district}. Terreno peligroso, {name}. A no descuidarse.'
    ],
    en: [
      'Rolling into {district}. Watch the shadows and keep your iron ready, friend.',
      'Entering {district} territory. Keep your ICE chilled, {name}.'
    ]
  },

  objective_taken: {
    es: [
      '¡Objetivo asegurado para el equipo! Ventaja táctica nuestra, friend.',
      '¡Gran objetivo capturado! Se siente el dominio en el mapa, {name}.'
    ],
    en: [
      'Objective secured! Tactical advantage is ours, friend.',
      'Major objective taken! The map belongs to us, {name}.'
    ]
  },

  objective_lost: {
    es: [
      '¡Nos robaron el objetivo! Qué jungla diff por favor, ni apareció con el smite.',
      'El rival se llevó el objetivo... jungla diff total friend, qué desastre.',
      '¡Se llevaron el objetivo los rivales! Tremendo jungla diff, nos están regalando el mapa.',
      'Perdimos el objetivo... qué jungla diff, no metió ni las manos.'
    ],
    en: [
      'Enemy secured the objective! Absolute jungle diff, didn\'t even contest with smite!',
      'They stole the objective... huge jungle diff on display, friend.',
      'Lost the objective to the enemy squad! Massive jungle diff, completely out-smited.'
    ]
  },

  match_started: {
    es: [
      '¡Partida en marcha! Confiá en tus reflejos, friend.',
      '¡Sistemas en línea para el combate! A romperla, {name}.'
    ],
    en: [
      'Match started! Trust your instincts, {name}.',
      'Systems live and ready for battle! Let us do this, friend.'
    ]
  },

  match_ended: {
    es: [
      'Fin de la partida. ¡Gran esfuerzo y ciberware bien usado, friend!',
      '¡Partida cerrada! Buen combate, {name}.'
    ],
    en: [
      'Match ended. Great hustle and chrome well spent, friend!',
      'Game over! That was some solid netrunning, {name}.'
    ]
  },

  level_up: {
    es: [
      '¡Subiste de nivel! Más potencia de fuego para el rig, friend.',
      '¡Level up! Desbloqueando nuevo potencial, {name}.'
    ],
    en: [
      'Level up! More firepower wired into the rig, friend.',
      'Level up! Unlocking fresh potential, {name}.'
    ]
  },
  civilian_killed: {
    es: [
      '¡{name}! ¿Qué hacés?! ¿Te estás volviendo ciberpsicópata? ¡Era un civil inocente!',
      '¡Friend! ¿Estás demente? ¿Te agarró un brote de ciberpsicosis?! ¡Dejá a los civiles tranquilos o nos cae MaxTac!',
      '¿Estás psico, {name}?! ¡Calmá los implantes ya mismo, le diste a un civil que no tenía nada que ver!',
      '¡Pará la mano, friend! ¿Perdiste la cordura con todo ese cromo? ¡Me estás asustando, eso era un peatón inocente!'
    ],
    en: [
      '{name}! What are you doing?! Are you going full cyberpsycho on me?! That was an innocent civilian!',
      'Friend! Have you lost your mind? Is this a cyberpsychosis outbreak?! Leave the civilians alone or MaxTac will drop us!',
      'Are you going psycho, {name}?! Chill those implants right now, you just zeroed a total bystander!',
      'Hold your fire, friend! Did all that chrome fry your humanity? You are scaring me, that was an innocent pedestrian!'
    ]
  },

  high_speed_driving: {
    es: [
      '¡Metéle pata, friend! ¡A esa velocidad esquivamos hasta el ICE de the hawks!',
      '¡Fuaa! ¡Qué aceleración! ¡Cuidado con el tráfico en la autopista, {name}!',
      '¡Volando por the rookery! ¡Agarrate fuerte que los frenos son opcionales!'
    ],
    en: [
      'Floor it, {name}! At this speed we can outrun the hawks orbital nets!',
      "Love the velocity, friend! We're tearing through the asphalt of the rookery!",
      "Now that's what I call speed! Keep your eyes on the road and hold on tight, {name}!"
    ]
  },

  extreme_speed: {
    es: [
      '¡Fuaa, {name}! ¡Vamos cortando el asfalto de the rookery como un rayo! ¡Mantenelo en la calle!',
      '¡El velocímetro está que explota! A este paso perforamos el Blackwall de un saque, friend.',
      '¡Eso sí que es velocidad pura! ¡Pisa a fondo, friend, que no nos agarra ni MaxTac!'
    ],
    en: [
      'Holy static, {name}! We are tearing through the rookery at warp speed! Keep it on the road!',
      "Speedometer is redlining! At this rate, we're gonna pierce the Blackwall itself, friend!",
      "Now this is real velocity! Floor it, friend, let's leave the cops in the dust!"
    ]
  },

  vehicle_crash: {
    es: [
      '¡Uff! ¡Agarrate el ciberware, friend! ¡Tremendo palo nos pegamos!',
      '¡Frenos, {name}, frenos! ¿Quién te enseñó a manejar, los Scavs?!',
      '¡Saltaron los airbags cibernéticos! Espero que tengas seguro con los fixers de Heywood, friend.',
      '¡Crack! ¡Dejamos medio paragolpes incrustado en esa pared, {name}!',
      '¡Uff, hasta a mí me vibraron los procesadores ópticos con ese impacto! ¡Mirá el camino, friend!'
    ],
    en: [
      'Whoa! My gyro sensors just recalibrated after that smash, {name}! Watch the concrete!',
      'Suspension just took a beating! Did that lamppost jump out at us, friend?!',
      'Smooth drift... right into a barricade! The fixers are gonna charge us for that bumper.',
      'Hope the airbags in this clunker are certified by Trauma Team, {name}!',
      'That was metal on concrete! Keep your eyes on the road, friend!',
      'Oof! My visual feed just flickered from that impact. Let us not turn this ride into scrap metal!',
      'Well, that is one way to test the crumple zones. Next time, try easing off the throttle, {name}!',
      'Crunch! Hope you got eddies saved up, because this paint job is officially ruined, friend.',
      'Did a Scav design these brakes or what?! Steer clear of the walls, {name}!',
      'That curb had a personal vendetta against us! Check the alignment, friend.',
      'Hold on to your chrome! If we hit another pillar like that, we are walking back to Watson!',
      'Preem driving, {name}... if the goal was remodeling that shopfront! Ease up on the steering!'
    ]
  },

  sandevistan_activated: {
    es: [
      '¡Sandevistan activo! Mirá cómo se mueven en cámara lenta... ¡Hacelos pedazos, {name}!',
      '¡El tiempo se congeló, friend! ¡Bailá entre sus balas y no dejes a ninguno en pie!',
      '¡Reflejos neuronales al máximo! ¡Desarmalos antes de que puedan pestañear, friend!'
    ],
    en: [
      'Sandevistan engaged! Move like a ghost, {name}!',
      'Time slowed down to a crawl... carve them up before they can blink!',
      'Sandevistan overclocking your nervous system! Slice them to ribbons, friend!',
      'World is in slow motion! Dance between their bullets, {name}!'
    ]
  },

  kerenzikov_activated: {
    es: [
      '¡Kerenzikov activado! ¡Tremenda esquiva en cámara lenta, {name}!',
      '¡Reflejos de Kerenzikov al rescate! ¡Alineá el disparo mientras están congelados!',
      '¡Gran deslizamiento con Kerenzikov, friend! ¡Aprovechá la ventana!'
    ],
    en: [
      'Kerenzikov kicked in! Line up that headshot while they are frozen!',
      'Kerenzikov reflex boost active! Preem slide, {name}, take your shot!',
      'Smooth reflex dodge! Kerenzikov opened the window, finish them!',
      'Reflex booster firing! Everything is standing still for you, friend!'
    ]
  },

  synaptic_accelerator_activated: {
    es: [
      '¡Acelerador Sináptico disparado! ¡Nos detectaron, bajalos antes de que alerten a la banda!',
      '¡Fogonazo del Acelerador Sináptico! ¡Tenés la iniciativa, friend, dispará!',
      '¡Tiempo ralentizado por Acelerador Sináptico! ¡Neutralizalos antes de que reaccionen!'
    ],
    en: [
      'Synaptic Accelerator triggered! They spotted us, drop them before they alert the squad!',
      'Synaptic reflex flare! Hostile detected, you have the jump on them, {name}!',
      'Synaptic boost! Hostile locked onto you, neutralize them while time is dilated!',
      'Sensors flared! Synaptic Accelerator giving you the first strike, take it!'
    ]
  },

  overclock_activated: {
    es: [
      '¡Overclock encendido! ¡Quemá esa RAM y subiles demonios a la cabeza, friend!',
      '¡Núcleo neuronal al rojo vivo con pura potencia! ¡Perforales el ICE por completo, {name}!'
    ],
    en: [
      'Overclock ignited! Burn that RAM and upload daemons into their skulls, friend!',
      'Neural core redlining with cyberware power! Fry their ICE clean through, {name}!'
    ]
  },

  berserk_activated: {
    es: [
      '¡Berserk desbloqueado! ¡Pura adrenalina y cromo de titanio reforzado! ¡Hacelos trizas, friend!',
      '¡Desatá la bestia, {name}! ¡No te tocan ni un pelo mientras el Berserk esté bombeando!'
    ],
    en: [
      'Berserk unlocked! Pure adrenaline and reinforced titanium chrome! Rip them apart, friend!',
      "Unleash the beast, {name}! They can't scratch your armor while Berserk is pumping!"
    ]
  },

  player_quickhack: {
    es: [
      '¡ICE perforado! ¡Eso sí que es hackeo de élite, friend!',
      '¡Subida de demonio completada! Su ciberware está frito, {name}.',
      '¡Directo a su procesador neuronal! Hermoso quickhack, friend.'
    ],
    en: [
      "ICE breached! That's elite netrunning, {name}!",
      "Daemon uploaded! Their cyberware is completely scrambled, friend.",
      'Fried their neural processor clean! Beautiful quickhack, {name}!'
    ]
  },

  player_being_hacked: {
    es: [
      '¡Alerta friend! ¡Un crow enemigo nos está subiendo un quickhack! ¡Cortále la señal ya!',
      '¡Fuego en los buffers neuronales! ¡Nos están hackeando, {name}! ¡Buscá al crow hostil!',
      '¡Intrusión en el subnet! ¡Reforzando ICE... neutralizá a ese hacker rápido!'
    ],
    en: [
      'Warning! Enemy crow uploading into our subnet! Counter-hack them fast, {name}!',
      "Neural breach detected! They're pushing malware into our cyberware, friend! Find that runner!",
      'ICE under attack! Disconnect their uplink or flatline that crow now!'
    ]
  },

  poi_marked: {
    es: [
      '¡Firma localizada, friend! Te acabo de marcar a {name} en {district}, a solo {distance} metros. Seguí la ruta en tu óptica.',
      'Ruta trazada en tu minimapa, {name}. El punto más cercano es {name} a {distance} metros. Cuidado con ese ciberware.',
      'Óptica sincronizada: {name} en {district}, a {distance} metros. ¡Llegás al toque, friend!'
    ],
    en: [
      'Optics linked, V! Plotted a direct route to {name} in {district}, {distance} meters out. Follow the minimap!',
      'Scanning the rookery grid... Nearest waypoint locked: {name} at {distance} meters. Route active on your HUD, friend!',
      'Found him, {name}! {name} in {district}, roughly {distance} meters away. Watch your back on the way.'
    ]
  },

  gig_marked: {
    es: [
      '¡EY QUE TAL ESTE?! Encargo: {name} en {district} por {fixer}. {description} ¡Ruta fijada en tu óptica, friend!',
      '¡EY, QUE TAL ESTE?! {name} en {district} de {fixer}. {description} ¡Marcado en tu minimapa, vamos por esos edis, friend!'
    ],
    en: [
      'HEY, HOW ABOUT THIS ONE?! Gig: {name} in {district} from {fixer}! {description} Waypoint locked on your optics, friend. Let\'s roll!',
      'EY, WHAT ABOUT THIS ONE?! Gig: {name} from {fixer} in {district}! {description} I just plotted the route on your HUD, let\'s get to work!'
    ]
  },

  kda_praise: {
    es: [
      '¡Qué bestia, {name}! Estás carreando a estos conos vos solo, qué jugada metiste.',
      '¡Mirá ese KDA friend! Sos una máquina de matar cromada hoy.',
      '¡Imparable! Directo a los anales de la Grieta, qué manera de borrar rivales.'
    ],
    en: [
      'What an absolute beast, {name}! Carrying this team all on your own, great work!',
      'Look at that KDA, friend! You are a lethal chrome machine today.',
      'Unstoppable! Slicing through the enemy squad with zero mercy.'
    ]
  },

  kda_roast: {
    es: [
      'Uff {name}... ¿le estás donando oro a la caridad de la Grieta o qué? Ponete las pilas friend jajaja.',
      'Che friend... te están cazando como a un borg en the hawks Tower jajaja.',
      'Pará un poco de respawnear directo para morir, que se te van a gastar los cromos.'
    ],
    en: [
      'Oof {name}... are you donating gold to Rift charity or what? Lock in, friend! Haha.',
      'Hey friend... they are hunting you down like an the hawks borg haha.',
      'Stop respawning just to feed them direct, you are gonna wear out your chrome!'
    ]
  },

  player_feeder_alert: {
    es: [
      'Mirá ese jungla, qué malo... no gankeó una sola línea y regala todo.',
      'Che, mirá a ese feeder... parece un minion con skin de adorno jajaja.',
      'Ese jugador rival nos está regalando la partida en bandeja de plata, qué desastre.'
    ],
    en: [
      'Look at that feeder, what a bot! Donating gold like candy.',
      'Check out that teammate... basically a lane minion for decoration haha.',
      'Their player is handing us this match on a silver platter, total clown fiesta.'
    ]
  },

  player_carrying_alert: {
    es: [
      '¡Ojo con ese rival que viene re armado! Si no le tiramos todo el CC nos va a borrar.',
      'Cuidado friend, ese rival está pegando como camión corporativo.'
    ],
    en: [
      'Watch out, that enemy is heavily fed! Chain your CC or they will wipe us.',
      'Careful friend, that target is hitting like a corpo gunship.'
    ]
  },

  custom: {
    es: [
      '¡Atento a la jugada, friend!',
      'Registrado en los sensores, {name}.'
    ],
    en: [
      'Eyes sharp on the play, friend!',
      'Registered on telemetry, {name}.'
    ]
  }
}

export function getRandomReactionTemplate(
  type: GameEventType,
  lang: 'es' | 'en' = 'es',
  multikillCount?: number
): string {
  const set = GAME_REACTION_TEMPLATES[type] || GAME_REACTION_TEMPLATES.custom
  const list = lang === 'es' ? set.es : set.en

  if (type === 'multikill' && multikillCount && multikillCount >= 2) {
    const idx = Math.min(multikillCount - 2, list.length - 1)
    return list[idx]
  }

  const chosen = list[Math.floor(Math.random() * list.length)]
  return chosen
}
