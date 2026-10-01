import type { Studio } from './types'

// The demo studio. Everything a real studio changes lives in this shape
// (stored as studios.config in Supabase). [Brackets] mark what the studio supplies.
export const DEMO_STUDIO: Studio = {
  id: 'demo-studio',
  slug: 'arch-and-ink',
  config: {
    name: 'Arch & Ink Brow Studio',
    initials: 'A&I',
    city: '[Your City]',
    artist: {
      name: 'Maya',
      title: 'Licensed PMU artist',
      years: '[8]',
      bio: '[Two or three lines from the artist: how she started, what she specialises in, and why clients trust her.]',
    },
    rating: '[5.0]',
    reviewCount: '[120]',
    replyTime: '[2 hours]',
    deposit: 50,
    reschedule: '48 hours',
    address: '[Street address, suite]',
    hours: '[Tue–Sat, 9am–6pm]',
    instagram: '@archandink.studio',
    phone: '[(555) 000-0000]',
    bookingUrl: 'https://example.com/your-booking-page',
    bookingTool: 'GlossGenius',
    receptionistName: 'Ava',
    services: [
      { key: 'micro', name: 'Microblading', group: 'brows', price: 450, duration: '2.5 hrs', lasts: '1–2 yrs', why: 'Fine, hair-like strokes blend with your own brows for the most natural result.' },
      { key: 'powder', name: 'Powder Brows', group: 'brows', price: 500, duration: '2.5 hrs', lasts: '2–3 yrs', why: 'A soft, shaded fill that looks like lightly applied brow powder and evens out gaps.' },
      { key: 'combo', name: 'Combo Brows', group: 'brows', price: 550, duration: '3 hrs', lasts: '2–3 yrs', why: 'Hair strokes at the front, soft shading through the tail. Natural up close, full from a distance.' },
      { key: 'refresh', name: 'Colour Refresh', group: 'brows', price: 250, duration: '1.5 hrs', lasts: '1–2 yrs', why: 'Brings faded pigment back to life and sharpens the shape you already have.' },
      { key: 'lipblush', name: 'Lip Blush', group: 'lips', price: 500, duration: '2.5 hrs', lasts: '2–3 yrs', why: 'A soft wash of colour that evens out your lip tone and defines the edges.' },
      { key: 'neutral', name: 'Lip Neutralization', group: 'lips', price: 550, duration: '3 hrs', lasts: '2–3 yrs', why: 'Evens out darker lip tones first, so your chosen colour heals true.' },
      { key: 'lash', name: 'Lash Line Enhancement', group: 'eyes', price: 350, duration: '2 hrs', lasts: '2–3 yrs', why: 'Pigment placed between the lashes. They look fuller, with no visible line.' },
      { key: 'liner', name: 'Classic Eyeliner', group: 'eyes', price: 400, duration: '2 hrs', lasts: '2–3 yrs', why: 'A defined liner that is there when you wake up and never smudges.' },
      { key: 'correct', name: 'Correction Session', group: 'fix', price: 300, duration: '2 hrs', lasts: 'varies', why: 'We assess the old pigment first, then correct colour and shape, or plan lightening if needed.' },
    ],
    faqs: [
      { id: 'pain', q: 'Does it hurt?', a: 'Most clients describe it as light scratching. We apply numbing cream first and top it up during the session.' },
      { id: 'fake', q: 'What if it looks fake?', a: 'Nothing is tattooed until you approve it. We draw the shape and choose the colour with you first, and you check it in the mirror.' },
      { id: 'heal', q: 'What is healing like?', a: 'Expect about a week of visible healing: a little darker at first, then light flaking. Most clients carry on with their day. Your touch-up at 6–8 weeks perfects it.' },
      { id: 'price', q: 'What does it cost in total?', a: 'The price shown includes your 6–8 week touch-up. A $50 deposit holds your time and comes off the total. [Payment plans available.]' },
      { id: 'suit', q: 'How do I know it will suit me?', a: 'We match the shape to your face and the colour to your skin and hair. Still unsure? Book the free 15-minute consult first.' },
      { id: 'last', q: 'How long does it last?', a: 'Usually 1–3 years, depending on the service and your skin. A yearly colour boost keeps it fresh.' },
      // Health & safety: Ava answers these word for word. Edit them to match your studio's own policy.
      { id: 'preg', group: 'health', q: 'Can I book if I am pregnant or breastfeeding?', a: 'We don\'t do permanent makeup during pregnancy or while breastfeeding. Hormones change how your skin heals and holds colour, so we wait until you\'ve finished breastfeeding. We\'re happy to pencil you in for then.' },
      { id: 'allergy', group: 'health', q: 'What if I have allergies?', a: 'Tell us about any allergies before your appointment, especially to numbing creams (such as lidocaine), metals or previous tattoo pigments. If you have known sensitivities, we do a small patch test a few days before.' },
      { id: 'skin', group: 'health', q: 'Can I have it with eczema, psoriasis or rosacea?', a: 'We can\'t work on skin with an active flare-up, rash, sunburn, broken skin or active acne in the area. If your skin is calm, it\'s often fine, but we check it first. If you form keloids or raised scars, we\'ll talk it through at a consult and may ask you to check with your doctor.' },
      { id: 'meds', group: 'health', q: 'Do medications affect it?', a: 'Some do. After Accutane (isotretinoin) we wait at least 6 months from your last dose. Stop retinol or Retin-A on the area 2 weeks before. Blood thinners can cause extra bleeding, but never stop a prescribed medicine without asking your doctor.' },
      { id: 'conditions', group: 'health', q: 'I have a medical condition. Can I still book?', a: 'Many clients with conditions such as diabetes or autoimmune disease can have permanent makeup, sometimes with a note from their doctor. If you are having chemotherapy, we wait until your doctor gives the all-clear. Tell us about any condition when you book so we can plan safely.' },
    ],
    team: [
      { id: 'desk', role: 'Bookings and rescheduling', name: '[Front desk name]', title: 'Front desk', phone: '[(555) 000-0001]', hours: '[Tue–Sat, 9am–6pm]' },
      { id: 'artist', role: 'Treatment questions', name: 'Maya', title: 'Lead artist', phone: '[(555) 000-0002]', hours: '[Tue–Fri, 5–6pm call window]' },
      { id: 'owner', role: 'Corrections, sensitive skin, health questions', name: '[Owner name]', title: 'Owner', phone: '[(555) 000-0003]', hours: '[By callback]' },
    ],
    reviews: {
      brows: 'I was so scared they would look fake. They look like my own brows, just better.',
      lips: 'The colour healed so soft. People just think I have nice lips.',
      eyes: 'I wake up looking awake. No more smudged liner by lunchtime.',
      fix: 'Another artist left me with grey brows. After the correction they look like brows again.',
      any: 'She drew the shape first and did not start until I loved it. Zero pressure.',
    },
    consultTimes: ['11:00 am', '1:15 pm', '4:45 pm'],
  },
}
