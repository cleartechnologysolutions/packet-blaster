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
and red damaged armor below 35% health. The header displays `Build 9`.
