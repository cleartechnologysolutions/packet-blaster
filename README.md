# Packet Blaster

Original browser arcade shooter by Clear Technology Solutions.

Features five starting ships, score-based bonus ships, a tapered 40-alien
formation, staged curved entrances, formation attacks, bosses, powerups,
an original level-opening arcade fanfare, synthesized laser effects, animated
pixel ships, full destruction and respawn sequences, and drag-to-move/tap-to-fire
mobile controls.

Deploy command:

```bash
npx wrangler deploy
```

No database, storage bucket, or API keys are required.

Build 7: darker minor-key intro with low bass and a tense ending. Alien squads
descend in single-file lines, make a low sweeping turn where they can be shot,
and then climb into formation.

Build 8: holding mouse fire or Space for two seconds halves the firing rate.
Release to reset; rapid-fire powerups also slow to half their normal rate.
Mobile tap-to-fire stays unchanged.
Alien dives now use louder descending engine effects with metallic growl and
flutter, with different pitches for scouts, strikers, and commanders.

Build 9: alien abilities change every two levels:
- 1–2: original fleet.
- 3–4: twin gunners, two parallel lasers.
- 5–6: zigzag raiders, weaving entrances and dives.
- 7–8: spread hunters, three-shot fans.
- 9–10: corkscrew aces, looping entrances and dives.
- 11–12: armored twin gunners, one additional hit of armor.
- 13 onward: rotating combinations of movement, weapons, armor and colors.

Every pair keeps its variant while the existing per-level difficulty scaling
continues. Low, shootable entrances and the boss every fifth level remain.
Bosses have a new detailed pixel warship sprite, glowing eyes, animated engines,
and red damaged armor below 35% health.

Build 10: mixed fleets retain the previous alien group. Levels 1–2 stay original.
Odd levels from 3 onward have 24 current and 16 previous aliens; the following
even level has 32 current and 8 previous aliens. Only the immediately previous
group carries forward, in complete squads. Bosses remain additional enemies.
Enemy laser aiming is limited to 60 degrees from straight down, including outer
spread shots, so all shots fall with at least half their speed directed downward.
Build 11: alien sounds follow each individual alien's role and abilities, even
in mixed fleets. Twin gunners pulse, zigzag raiders warble, corkscrew aces swoop,
spread hunters have layered laser tones, and armor/bosses add a deeper register.
Entrance and dive effects share these signatures; enemy weapon sounds stay
quieter than dive effects. Player lasers and explosions are unchanged.
Six dark intro variations rotate each level, changing the motif and key while
preserving the 4.4-second musical duration and pre-level gameplay delay.
Build 12: the current alien group in every mixed fleet takes exactly two hits.
The first hit permanently changes its body and wings to silver-gray; the second
destroys it. This replaces, rather than adds to, its normal HP/armor. Older
aliens retain their existing durability; levels 1–2 and boss HP are unchanged.
Build 13: sustained fire builds heat. At 3 seconds the ship starts blinking red;
the blinking accelerates as heat approaches 8 seconds, when the ship explodes
and loses a life. Releasing fire cools at three times the heating rate, taking
under 3 seconds from almost full heat. The warning persists until fully cool.
Repeated mobile taps also generate heat. Shields do not prevent overheating.
New ships and level intros reset heat; pausing freezes it. The two-second fire
slowdown still applies. The header displays `Build 13`.
