import { Plus, X } from 'lucide-react';

interface StopAddressTextFieldsProps {
  pickups: string[];
  dropoffs: string[];
  onPickupsChange: (addresses: string[]) => void;
  onDropoffsChange: (addresses: string[]) => void;
}

function AddressList({
  title,
  addresses,
  onChange,
  addLabel,
}: {
  title: string;
  addresses: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const values = addresses.length > 0 ? addresses : [''];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          {title}
        </h4>
        <button
          type="button"
          onClick={() => onChange([...values, ''])}
          className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider"
        >
          <Plus size={14} /> {addLabel}
        </button>
      </div>
      {values.map((address, index) => (
        <div key={`${title}-${index}`} className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(event) => {
              const next = [...values];
              next[index] = event.target.value;
              onChange(next);
            }}
            placeholder="Street, city, state…"
            className="min-w-0 flex-1 bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {values.length > 1 && (
            <button
              type="button"
              aria-label={`Remove ${title} ${index + 1}`}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="p-2 text-on-surface-variant hover:text-error"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StopAddressTextFields({
  pickups,
  dropoffs,
  onPickupsChange,
  onDropoffsChange,
}: StopAddressTextFieldsProps) {
  return (
    <div className="space-y-6">
      <AddressList
        title="Pickups"
        addresses={pickups}
        onChange={onPickupsChange}
        addLabel="Add pickup"
      />
      <AddressList
        title="Dropoffs"
        addresses={dropoffs}
        onChange={onDropoffsChange}
        addLabel="Add dropoff"
      />
      <p className="text-xs text-on-surface-variant">
        Plain text from the rate con is enough. Addresses are geocoded automatically when you create
        the load; truck miles are calculated only if missing from the PDF.
      </p>
    </div>
  );
}
