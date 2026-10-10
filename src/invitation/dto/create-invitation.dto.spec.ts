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

// ---------------------------------------------------------------------------
// designSettings noir fields (heroCopy, eventStartTime, eventEndTime, hideRundown)
// ---------------------------------------------------------------------------

function designSettingsResult(designSettings: Record<string, unknown>) {
  const instance = plainToInstance(
    CreateInvitationDto,
    validPayload({ designSettings }),
  );
  const errors = validateSync(instance, { whitelist: true });
  const dsErrors = errors.filter((e) => e.property === 'designSettings');
  const childProps = dsErrors.flatMap((e) =>
    (e.children ?? []).map((c) => c.property),
  );
  return { instance, dsErrors, childProps, errors };
}

describe('CreateInvitationDto - designSettings noir fields', () => {
  it('accepts all four new keys and keeps them after whitelist validation', () => {
    const { instance, dsErrors } = designSettingsResult({
      heroCopy: 'Contoh teks sambutan',
      eventStartTime: '08:00',
      eventEndTime: '12:30',
      hideRundown: true,
    });
    expect(dsErrors).toHaveLength(0);
    expect(instance.designSettings).toMatchObject({
      heroCopy: 'Contoh teks sambutan',
      eventStartTime: '08:00',
      eventEndTime: '12:30',
      hideRundown: true,
    });
  });

  it('trims heroCopy', () => {
    const { instance, dsErrors } = designSettingsResult({
      heroCopy: '  Contoh teks sambutan  ',
    });
    expect(dsErrors).toHaveLength(0);
    expect(instance.designSettings?.heroCopy).toBe('Contoh teks sambutan');
  });

  it('accepts empty strings for heroCopy and both times', () => {
    const { dsErrors } = designSettingsResult({
      heroCopy: '',
      eventStartTime: '',
      eventEndTime: '',
    });
    expect(dsErrors).toHaveLength(0);
  });

  it.each(['00:00', '23:59', '08:00', '12:30'])('accepts time %s', (t) => {
    expect(
      designSettingsResult({ eventStartTime: t, eventEndTime: t }).dsErrors,
    ).toHaveLength(0);
  });

  it.each(['24:00', '25:00', '8:00', '08:0', '08:00:00', 'abc', '12:60'])(
    'rejects time %s',
    (t) => {
      expect(designSettingsResult({ eventStartTime: t }).childProps).toContain(
        'eventStartTime',
      );
      expect(designSettingsResult({ eventEndTime: t }).childProps).toContain(
        'eventEndTime',
      );
    },
  );

  it('rejects heroCopy longer than 400 chars and accepts exactly 400', () => {
    const tooLong = designSettingsResult({ heroCopy: 'a'.repeat(401) });
    expect(tooLong.childProps).toContain('heroCopy');
    const ok = designSettingsResult({ heroCopy: 'a'.repeat(400) });
    expect(ok.dsErrors).toHaveLength(0);
  });

  it('rejects non-boolean hideRundown', () => {
    expect(designSettingsResult({ hideRundown: 'yes' }).childProps).toContain(
      'hideRundown',
    );
  });

  it('allows all new fields to be omitted', () => {
    expect(designSettingsResult({}).dsErrors).toHaveLength(0);
  });

  it('still accepts the pre-existing designSettings shape', () => {
    const { instance, dsErrors } = designSettingsResult({
      fontFamily: 'DM Sans',
      titleScale: 1,
    });
    expect(dsErrors).toHaveLength(0);
    expect(instance.designSettings).toMatchObject({
      fontFamily: 'DM Sans',
      titleScale: 1,
    });
  });
});
