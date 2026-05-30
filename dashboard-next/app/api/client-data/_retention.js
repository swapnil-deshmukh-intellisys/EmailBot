const UPLOAD_RETENTION_DAYS = 7;

export function activeListFilter(extra = {}) {
  return {
    ...extra,
    $and: [
      ...(Array.isArray(extra.$and) ? extra.$and : []),
      {
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } }
        ]
      },
      {
        kind: { $ne: 'paste_workspace' }
      }
    ]
  };
}

export function binListFilter(extra = {}) {
  return {
    ...extra,
    deletedAt: { $ne: null }
  };
}

export function uploadExpiryDate(now = new Date()) {
  return new Date(now.getTime() - UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function nextAutoDeleteDate(now = new Date()) {
  return new Date(now.getTime() + UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function moveExpiredUploadsToBin(LeadList, ownerQuery, now = new Date()) {
  await LeadList.updateMany(
    {
      ...ownerQuery,
      deleteReason: 'Auto moved to bin after 7 days',
      originalKind: 'uploaded',
      $or: [
        { autoDeleteAt: null },
        { autoDeleteAt: { $exists: false } }
      ]
    },
    {
      $set: {
        deletedAt: null,
        deleteReason: '',
        autoDeleteAt: nextAutoDeleteDate(now),
        kind: 'uploaded'
      }
    }
  );

  await LeadList.updateMany(
    {
      ...ownerQuery,
      $and: [
        {
          $or: [
            { deletedAt: null },
            { deletedAt: { $exists: false } }
          ]
        },
        {
          $or: [
            { kind: 'uploaded' },
            { kind: { $exists: false } },
            { kind: '' }
          ]
        },
        {
          $or: [
            { autoDeleteAt: null },
            { autoDeleteAt: { $exists: false } }
          ]
        }
      ]
    },
    {
      $set: {
        autoDeleteAt: nextAutoDeleteDate(now)
      }
    }
  );

  await LeadList.updateMany(
    {
      ...ownerQuery,
      $and: [
        {
          $or: [
            { deletedAt: null },
            { deletedAt: { $exists: false } }
          ]
        },
        {
          $or: [
            { kind: 'uploaded' },
            { kind: { $exists: false } },
            { kind: '' }
          ]
        },
        {
          autoDeleteAt: { $lte: now }
        }
      ]
    },
    {
      $set: {
        deletedAt: now,
        deleteReason: 'Auto moved to bin after 7 days',
        originalKind: 'uploaded',
        autoDeleteAt: now
      }
    }
  );
}
