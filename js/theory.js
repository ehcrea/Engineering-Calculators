/*
 * Short theory notes shown by the "?" help icon of each calculator.
 * intro: one paragraph; points: key insights; assumptions: validity limits.
 */
(function (root) {
  'use strict';
  var THEORY = {
    'leaf-spring': {
      intro: 'A leaf spring is a thin plate that bends easily through its thickness (x) but is very stiff in its own plane. It works as a frictionless, play-free guide: compliant in x, stiff in y, z and the in-plane rotation.',
      points: [
        'S-shape: both ends clamped, so the moving end stays parallel. It is 4× stiffer than the C-shape (free end) with the same dimensions.',
        'Compliant stiffness grows with t³ and drops with L³. Doubling the thickness makes it 8× stiffer.',
        'For a given stroke the stress is σ ∝ E·t·uₓ/L². Long, thin springs give the most stroke.',
        'The end also moves axially by u_z ≈ 0.6·uₓ²/L, and the axial stiffness C_z falls quickly as the spring deflects.',
        'Use the fatigue limit for moving parts and the yield limit for static deformation.'
      ],
      assumptions: ['Linear elastic, small deflections', 'Slender: L/t > 10', 'Rectangular section, ideal clamping']
    },
    'rod-spring': {
      intro: 'A rod (wire) flexure is a thin round bar. It is compliant laterally in both directions and in torsion, and stiff only along its axis. It fixes a single degree of freedom, which makes it ideal as a strut, for example in a hexapod or a statically determined support.',
      points: [
        'S-shape (both ends clamped) is 4× stiffer laterally than the C-shape.',
        'Lateral stiffness scales with d⁴/L³, so a small change in diameter has a big effect.',
        'Axial stiffness drops as the rod deflects laterally (C_z(uₓ)).',
        'Under compression the rod can buckle. Check F_b against the axial load.'
      ],
      assumptions: ['Linear elastic, small deflections', 'L/d > 10', 'No necked sections']
    },
    'folded-leaf-spring': {
      intro: 'A folded (L-shaped) leaf spring is two leaf springs at 90°. Each leg bends, so the free end can move in both in-plane directions while staying stiff out of plane. You get a large stroke in a compact space.',
      points: [
        'The stiffness depends on the direction of the force (θ), and the end does not move exactly in the force direction (φ ≠ θ).',
        'The largest bending moment occurs at the clamp or at the corner.',
        'Out-of-plane stiffness C_z combines bending of both legs as one plate with shear.',
        'With a guided end (rotation fixed) and L₁ = L₂ the stiffness is (15/2)·EI/L³.'
      ],
      assumptions: ['Linear elastic, small deflections', 'Torsion of leg 1 neglected for C_z']
    },
    'flexure-hinge': {
      intro: 'A notch (elastic) hinge is made by cutting two circular notches into a solid block, leaving a thin neck of thickness h. Rotation concentrates in the neck, so the part rotates about the hinge without friction, play or wear, and it can be machined monolithically.',
      points: [
        'Rotational stiffness K_Ay ≈ 0.093·E·t·h²·√(h/D). It is very sensitive to the neck thickness h.',
        'β = h/D sets the trade-off: a small β gives low rotational stiffness but also low support stiffness.',
        'Stress grows with rotation: σ ≈ 0.58·E·√(h/D)·R_y. Notch hinges are limited to small angles (typically well under a degree for metals).',
        'Stiffness at a lever point B combines the hinge translation with rotation times the lever arm (1/C_B = 1/C_A + L²/K_A).'
      ],
      assumptions: ['0.01 < β < 0.5', 'Small rotations', 'C_Ay is only a rough estimate']
    },
    'cross-spring-pivot': {
      intro: 'A cross spring pivot uses two leaf springs that cross each other (in projection). Together they block both translations but allow rotation about the line where they cross. It is a frictionless rotary bearing for limited angles.',
      points: [
        'The pole position a (fraction of L) sets the stiffness: K = 8(1 − 3a + 3a²)·EI/L, which is lowest at a = 0.5.',
        'The centre of rotation shifts slightly with angle (parasitic motion). At a = 0.5 ± √5/6 the rolling radius is zero.',
        'A radial load can buckle the springs: F_b,ref = 8π²EI/L².',
        'The maximum angle is limited by stress: θ_ref = 2σ·L/(E·t). Thin springs rotate further.'
      ],
      assumptions: ['Identical leaf springs', 'Orthogonal crossing', 'Small angles']
    },
    'cross-section': {
      intro: 'The second moment of area I = ∫y²·dA measures how well a cross-section resists bending. Material far from the neutral axis counts most, which is why I-beams and tubes are so efficient.',
      points: [
        'For a rectangle I = w·h³/12. Height counts cubed, so a beam laid flat is much weaker.',
        'Bending stress σ = M/W, with section modulus W = I/e and e the distance to the outer fibre.',
        'Bending about the weak axis (smallest I) governs buckling.',
        'The torsion constant J_T equals the polar moment only for circular sections. Open sections have a very small J_T.'
      ],
      assumptions: ['Homogeneous material', 'Bending about the centroidal axes']
    },
    'tension-shear': {
      intro: 'Hooke\'s law for a bar: under axial force it stretches (σ = E·ε), and under transverse force it shears (τ = G·γ). Stiffness depends on the material (E, G) and the shape (A/l).',
      points: [
        'Axial stiffness C_z = E·A/l. Long, thin members are compliant.',
        'G = E/(2(1+ν)) ≈ 0.38·E for metals.',
        'The bar also narrows sideways by the Poisson ratio: Δh/h = −ν·ε.',
        'Combined stresses are checked with von Mises: σ_V = √(σ² + 3τ²).'
      ],
      assumptions: ['Uniform stress over the section (average shear)', 'Linear elastic']
    },
    'beam-bending': {
      intro: 'Euler–Bernoulli beam theory: the curvature of a beam equals M/(E·I). Integrating twice and applying the support conditions gives the deflection curve, slopes and stiffness for each load case.',
      points: [
        'Stiffness scales with E·I/L³, so length matters most. Halving L gives an 8× stiffer beam.',
        'Clamped ends are much stiffer than pinned ends. For a central load, clamped–clamped is 4× stiffer than simply supported.',
        'The maximum stress is at the point of maximum moment, at the outer fibre: σ = M·e/I.',
        'Self-weight is a uniform load q = ρ·g·A.'
      ],
      assumptions: ['Slender beam: L/h > 10 (shear deformation neglected)', 'Small slopes (< 5°)', 'Linear elastic']
    },
    'torsion': {
      intro: 'A shaft loaded by a torque T twists by θ = T·L/(G·J_T). The torsion constant J_T depends strongly on the shape of the section.',
      points: [
        'Closed sections (tubes, boxes) are orders of magnitude stiffer in torsion than open sections (strips, I-beams, slit tubes) of the same area.',
        'For a thin strip J_T ≈ w·h³/3. That is why leaf springs are compliant in torsion.',
        'Maximum shear is at the outer surface of a round shaft and at the middle of the long side of a rectangle.',
        'Von Mises for pure shear: σ_V = √3·τ.'
      ],
      assumptions: ['Free warping (see restrained warping for clamped leaf springs)', 'Linear elastic']
    },
    'buckling': {
      intro: 'A slender column under compression stays straight until the load reaches the Euler load F_b = π²·E·I/(k·L)². Above that it suddenly bows sideways (buckles), even though the stress may still be well below yield.',
      points: [
        'End conditions set the effective length k·L, from k = 2 (clamped–free) to k = 0.5 (clamped–clamped). The difference is a factor of 16 in load.',
        'The weakest axis (smallest I) buckles first.',
        'Stocky columns (low slenderness) yield before they buckle. Check that σ_b exceeds the yield strength.',
        'Real columns have imperfections and eccentric loads, so keep a healthy margin F_b/F.'
      ],
      assumptions: ['Ideal straight column, centric load', 'Linear elastic material']
    },
    'hertz-contact': {
      intro: 'When two curved bodies are pressed together they flatten locally into a small circular or elliptical contact. Hertz theory gives the contact size, approach and pressure from the curvatures, the elastic moduli and the load.',
      points: [
        'The behaviour is non-linear: approach δ ∝ F^(2/3), contact size ∝ F^(1/3). Stiffness rises with load, which is why preload stiffens a contact.',
        'Large radii (or a ball in a conforming groove) and stiff materials give a stiffer contact and lower pressure.',
        'The maximum shear stress is just below the surface (about 0.48·a deep for a sphere). Fatigue cracks start there.',
        'Local stiffness dF/dδ = 1.5·F/δ.'
      ],
      assumptions: ['Smooth, frictionless, non-conforming surfaces', 'Contact small compared with the radii', 'Linear elastic']
    },
    'impact-force': {
      intro: 'A mass m hitting a spring at velocity v₀ is decelerated as the spring compresses. All of the kinetic energy ½·m·v₀² becomes spring energy ½·c·u², which gives the peak force and approach.',
      points: [
        'Peak force F = v₀·√(m·c). A stiffer contact means a higher force over a shorter time.',
        'Contact time to standstill: t = (π/2)·√(m/c), a quarter of the mass–spring period.',
        'Springs in series (c = C₁C₂/(C₁+C₂)): a soft bumper limits the force.',
        'For hard bodies, use the local Hertz stiffness at the expected load.'
      ],
      assumptions: ['Undamped, linear spring', 'Rigid mass']
    },
    'equivalent-stiffness': {
      intro: 'Springs in series share the same force, so their compliances (1/C) add. Springs in parallel share the same displacement, so their stiffnesses add.',
      points: [
        'In series the weakest element dominates. A stiff frame cannot compensate for a compliant joint.',
        'Eigenfrequency f₀ = (1/2π)·√(C/m).',
        'Rule of thumb: f₀ ≈ 15.8/√(δ[mm]) Hz, where δ is the static sag under gravity.'
      ],
      assumptions: ['Linear springs', 'Lumped (rigid) mass']
    },
    'motion-profile': {
      intro: 'A third-order (jerk-limited, S-curve) profile moves a distance s while limiting velocity, acceleration and jerk. The motion has up to seven phases: jerk up, constant acceleration, jerk down, cruise, then the mirror image.',
      points: [
        'Limiting jerk avoids sudden steps in force, so it excites fewer resonances and settles faster.',
        'When all limits are reached, the move time is t ≈ s/v + v/a + a/j.',
        'Short moves never reach v_max (and sometimes not a_max). The calculator picks the right profile shape (I–VI).',
        'Peak motor force follows from m·a_max. Use the acceleration plot to size the drive.'
      ],
      assumptions: ['Start and end at rest', 'Symmetric acceleration and deceleration']
    },
    'thermal-bolt-compensation': {
      intro: 'If a bolt and the parts it clamps shrink differently when cooled (or expand when heated), the preload changes. The joint may loosen or overload. Adding a spacer of a third material can make the clamped stack, on average, shrink exactly like the bolt.',
      points: [
        'Condition: (L_C·r_C + L_S·r_S)/(L_C + L_S) = r_B, with r the relative length change between the two temperatures.',
        'The bolt\'s r must lie between those of the clamped part and the spacer.',
        'At cryogenic temperatures use integrated values (r = ΔL/L from tables), not room-temperature α.'
      ],
      assumptions: ['Uniform temperature', 'Linear stack (no thread or head compliance effects)']
    },
    'thermal-expansion': {
      intro: 'A part changes length by ΔL = α·L·ΔT when its temperature changes. In precision mechanics this is often the largest error source.',
      points: [
        '100 mm of aluminium (α ≈ 23 µm/m·K) grows 2.3 µm per kelvin.',
        'A mismatch between joined materials causes drift or thermal stress.',
        'Use low-expansion materials (Invar, Zerodur, SiC) or matched pairs, and design so the thermal centre does not move.'
      ],
      assumptions: ['Constant α over the temperature range', 'Free expansion']
    }
  };

  root.PEC = root.PEC || {};
  root.PEC.THEORY = THEORY;
})(typeof window !== 'undefined' ? window : globalThis);
