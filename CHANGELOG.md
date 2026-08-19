# Changelog

All notable changes to Forma are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- IKEA KNOXHULT / ASPUDDEN panel colors (Oak, Dark Gray, Dark Gray-Green, White) and hardware finishes (Brushed Brass, Matte Black, Brushed Steel, White).
- BAGGANÄS knob and ENERYDA bow-pull geometry in the hardware library.
- ENHET cabinet legs (IKEA 104.490.18, 125 mm) in the hardware library.
- Oak wood-grain texture for the Oak color.
- Cabinet shelf placement by explicit height or even spacing.
- Cabinet vertical panels by explicit offset from the left or even spacing. Shelves split into bays around them.
- Favicon from the toolbar F mark.
- Toolbar buttons to hide the left and right sidebars.
- Live object-face snapping while moving (60 mm capture, on-face guide). Hold Shift for the 100 mm grid.
- Document title derived from the on-disk save/open filename.
- Save Version keeps a checkpoint in this browser. Version History can download `{title} - Version N.forma.json`.

### Changed

- Default display unit is centimetres. Domain values stay millimetres.
- Prebuilt cabinets use IKEA METOD frame sizes: Base 400/600/800 (800 × 600), Wall 600/800 (800 × 370, hung at 1400 mm), High 600 (2200 × 600). Loose side, divider, back, and door presets match the 800 mm carcass. Older library ids still load.
- Library splits **Panels** and **Fronts** into separate sections.
- Default appearance is white panels and matte-black hardware (schema 5 migration for autosaved docs).
- Finish UI copy is **Color** / **Hardware**.
- The magnet toggle is object snap, not the 100 mm grid. Rotation and scale increments still follow the toggle.
- Save Version no longer shrinks in the toolbar.
- Docs live under `docs/`.

### Fixed

- Wall cabinets no longer sit on the floor when inserted; they hang so their top lines up with High 2200.
- Moving, rotating, or renaming a cabinet panel no longer strips shelf controls. Add Shelf stays available when any piece of that cabinet is selected.
- Deleting a generated shelf or interior panel keeps the cabinet configurable (BUG-014); only removing a carcass piece (side, top, bottom, or back) demotes it.
- Add shelf and Space evenly fields show defaults (300 mm, 3 every 200 mm) and are wide enough to read.
