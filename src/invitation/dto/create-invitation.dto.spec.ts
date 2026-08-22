import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateInvitationDto, Religion } from './create-invitation.dto';

// Minimal valid payload covering every required (non-optional) field on
// CreateInvitationDto. Only `religion` varies between test cases — everything
// else stays fixed so the only errors that matter are the `religion` ones.
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Undangan Tes',
    groomName: 'John Doe',
    brideName: 'Jane Doe',
    loveStory: [],
    musicChoice: 'default1.mp3',
    isCustomMusic: false,
    bridePhotoUrl: 'https://cdn.com/bride.jpg',
    groomPhotoUrl: 'https://cdn.com/groom.jpg',
    akadLocation: { mapUrl: '', description: '', dateTime: '2026-01-01T09:00:00' },
    resepsiLocation: { mapUrl: '', description: '', dateTime: '2026-01-01T11:00:00' },
    isSingleEvent: true,
    mergeEvents: false,
    encryptedGuestName: true,
    menu: { title: 'Menu', items: [] },
    galleryImages: [],
    giftDeliveryAddress: [],
    socialMedia: {},
    parents: { brideParents: '', groomParents: '' },
    enableCover: true,
    enableGuestMessage: true,
    templateDesignId: 1,
    ...overrides,
  };
}

function religionErrors(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateInvitationDto, payload);
  const errors = validateSync(instance);
  return errors.filter((e) => e.property === 'religion');
}

describe('CreateInvitationDto - religion field', () => {
  it('accepts religion: umum with zero religion errors', () => {
    expect(religionErrors(validPayload({ religion: 'umum' }))).toHaveLength(0);
  });

  it.each(['islam', 'kristen', 'katolik', 'hindu', 'budha', 'umum'])(
    'accepts religion: %s',
    (religion) => {
      expect(religionErrors(validPayload({ religion }))).toHaveLength(0);
    },
  );

  it('rejects the legacy value "bebas" with an isEnum constraint', () => {
    const errors = religionErrors(validPayload({ religion: 'bebas' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('rejects wrong-case "Islam"', () => {
    const errors = religionErrors(validPayload({ religion: 'Islam' }));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('allows religion to be omitted entirely (optional)', () => {
    expect(religionErrors(validPayload())).toHaveLength(0);
  });

  it('allows religion: null (NULL stays a valid state)', () => {
    expect(religionErrors(validPayload({ religion: null }))).toHaveLength(0);
  });

  it('Religion.UMUM === "umum" and the enum has no bebas member', () => {
    expect(Religion.UMUM).toBe('umum');
    expect(Object.values(Religion)).not.toContain('bebas');
  });
});
