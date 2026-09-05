import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RELAY_PRESETS, type RelayPreset, type RelayPresetType } from "@/config/relays";
import { useAppContext } from "@/hooks/useAppContext";
import { useToast } from "@/hooks/useToast";

interface PresetOption {
  value: string;
  label: string;
  description: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    value: "mojobus",
    label: "MojoBus",
    description: "MojoBus Relays (relay.mojobus.co + Backup)",
  },
  {
    value: "fast",
    label: "Fast",
    description: "Schnelle Relays für maximale Performance",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Ausgewogene Mischung aus schnellen und zuverlässigen Relays",
  },
];

interface RelaySelectorProps {
  /** Optional: CSS-Klassen für den äußeren Container */
  className?: string;
}

export function RelaySelector({ className = '' }: RelaySelectorProps) {
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();

  // Detect current preset from read configuration
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const readUrls = config.read?.relayUrls || [];

    // Match Presets based on their relay URLs
    if (readUrls.length === 2 &&
        readUrls.includes('wss://relay.mojobus.co') &&
        readUrls.includes('wss://relays.mojobus.co')) {
      return 'mojobus';
    }

    if (readUrls.length === 3 &&
        readUrls.includes('wss://relay.mojobus.co') &&
        readUrls.includes('wss://relays.mojobus.co') &&
        readUrls.includes('wss://relay.primal.net')) {
      return 'fast';
    }

    if (readUrls.length === 4 &&
        readUrls.includes('wss://relay.mojobus.co') &&
        readUrls.includes('wss://relays.mojobus.co') &&
        readUrls.includes('wss://relay.primal.net') &&
        readUrls.includes('wss://nos.lol')) {
      return 'balanced';
    }

    // Default
    return 'mojobus';
  });

  // Gewähltes Preset als getyptes Objekt (für Anzeige unten)
  const selectedPresetConfig = RELAY_PRESETS[selectedPreset as RelayPresetType];
  const selectedPresetTimeout = selectedPresetConfig?.queryTimeout;

  const applyPreset = async (preset: string) => {
    const presetConfig: RelayPreset = RELAY_PRESETS[preset as RelayPresetType];

    if (!presetConfig || !presetConfig.relayUrls) {
      console.error("Invalid preset:", preset);
      toast({
        title: 'Fehler',
        description: 'Ungültiges Relay-Preset.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log("Applying relay preset:", preset);
      console.log("New relay configuration:", presetConfig);

      // Apply preset to both READ and WRITE configuration
      const readRelayUrls = presetConfig.relayUrls || [];
      const readMaxRelays = presetConfig.maxRelays || 1;
      const readQueryTimeout = presetConfig.queryTimeout || 2000;
      const writeRelayUrls = presetConfig.relayUrls || [];
      const writeMaxRelays = presetConfig.maxRelays || 1;
      const writeActiveRelay = presetConfig.relayUrls?.[0] || '';

      updateConfig((currentConfig) => ({
        ...currentConfig,
        read: {
          relayUrls: readRelayUrls,
          maxRelays: readMaxRelays,
          queryTimeout: readQueryTimeout,
        },
        write: {
          relayUrls: writeRelayUrls,
          maxRelays: writeMaxRelays,
          activeRelay: writeActiveRelay,
        },
        // Update legacy fields for backward compatibility
        relayUrls: presetConfig.relayUrls || [],
        activeRelay: presetConfig.relayUrls?.[0] || '',
        maxRelays: presetConfig.maxRelays || 1,
        queryTimeout: presetConfig.queryTimeout || 2000,
      }));

      setSelectedPreset(preset);
      toast({
        title: 'Relay-Preset angewendet',
        description: `${presetConfig.name} wurde aktiviert.`,
      });
    } catch (error) {
      console.error("Failed to apply preset:", error);
      toast({
        title: 'Fehler',
        description: 'Konnte Relay-Preset nicht anwenden.',
        variant: 'destructive',
      });
    }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    applyPreset(preset);
  };

return (
<div className={`space-y-6 ${className}`}>
<div>
<h3 className="text-lg font-semibold mb-4">Relay-Preset wählen</h3>
<p className="text-sm text-muted-foreground mb-6">
Wähle einen Relay-Preset für optimale Performance
</p>
</div>

<div>
<Label htmlFor="relay-preset">Relay-Preset wählen</Label>
<Select value={selectedPreset} onValueChange={handlePresetChange}>
<SelectTrigger id="relay-preset">
<SelectValue placeholder="Preset wählen..." />
</SelectTrigger>
<SelectContent>
{PRESET_OPTIONS.map((option) => (
<SelectItem key={option.value} value={option.value}>
<div className="flex flex-col">
<span className="font-medium">{option.label}</span>
<span className="text-xs text-muted-foreground">
{option.description}
</span>
</div>
</SelectItem>
))}
</SelectContent>
</Select>
</div>
  <p className="text-xs text-muted-foreground">
    3 Presets für verschiedene Einsatzszenarien
  </p>

  {selectedPreset && (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium mb-2">Gewähltes Preset: {selectedPreset}</h4>
      <div className="text-xs text-muted-foreground">
        {PRESET_OPTIONS.find(o => o.value === selectedPreset)?.description}
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="font-medium">Relays:</span>
          <div className="text-muted-foreground">
            {selectedPresetConfig?.relayUrls?.join(", ") || "-"}
          </div>
        </div>
        <div>
          <span className="font-medium">Max Relays:</span>
          <div className="text-muted-foreground">
            {selectedPresetConfig?.maxRelays || "-"}
          </div>
        </div>
        <div>
          <span className="font-medium">Timeout:</span>
          <div className="text-muted-foreground">
            {selectedPresetTimeout ? `${selectedPresetTimeout / 1000}s` : "-"}
          </div>
        </div>
        <div>
          <span className="font-medium">Deduplizierung:</span>
          <div className="text-muted-foreground">
            {config.enableDeduplication ? "Aktiv" : "Inaktiv"}
          </div>
        </div>
      </div>
    </div>
  )}
</div>
);
}
