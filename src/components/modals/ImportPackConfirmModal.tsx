"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";

import { Modal } from "../ui/Modal";
import { Button } from "../ui/buttons/Button";
import { SearchStyleInput } from "../ui/Input";
import { Checkbox } from "../ui/Checkbox";
import { GroupPicker } from "../ui/GroupPicker";
import { ImportPreviewChips } from "../profiles/import/ImportPreviewChips";
import {
  ImportSecurityPanel,
  ImportTrustWarning,
} from "../profiles/import/ImportSecurityPanel";
import { ImportRemovedList } from "../profiles/import/ImportRemovedList";
import { useImportConfirmStore } from "../../store/import-confirm-store";
import { useKnownProfileGroups } from "../../hooks/useKnownProfileGroups";
import { runPackImport } from "../../utils/pack-import";
import type { ImportPackPreview } from "../../types/importPreview";
import { formatBytes } from "../../utils/format-relative-time";
import { truncateEntry } from "../profiles/import/ImportSecurityPanel";

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

export function ImportPackConfirmModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, isLoading, preview, filePath, close } = useImportConfirmStore();
  const [isImporting, setIsImporting] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [useNoriskPack, setUseNoriskPack] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setGroup("");
      return;
    }
    if (preview) {
      setName(preview.profileName ?? "");
      setGroup(preview.group ?? "");
      setUseNoriskPack(preview.noriskPack.preselected);
    }
  }, [isOpen, preview]);

  const knownGroups = useKnownProfileGroups([preview?.group]);

  if (!isOpen) return null;

  const trimmedName = name.trim();

  const handleConfirm = async () => {
    const target = preview?.filePath ?? filePath;
    if (!target || !trimmedName) return;

    setIsImporting(true);
    close();
    const newProfileId = await runPackImport(target, {
      name: trimmedName,
      group: group.trim(),
      noriskPackId: useNoriskPack ? preview?.noriskPack.packId : undefined,
      clearNoriskPack: !useNoriskPack,
    });
    setIsImporting(false);
    if (newProfileId) {
      navigate(`/profilesv2/${newProfileId}`);
    }
  };

  const renderFooter = () => (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
      <Button variant="secondary" onClick={close} size="md" disabled={isImporting}>
        {t("common.cancel")}
      </Button>
      <Button
        variant="default"
        onClick={handleConfirm}
        size="md"
        disabled={isLoading || isImporting || !trimmedName}
        icon={<Icon icon="solar:download-bold" className="w-5 h-5 text-white" />}
      >
        {t("profiles.import.confirm")}
      </Button>
    </div>
  );

  return (
    <Modal
      title={t("profiles.import.review_title")}
      titleSubtitle={
        preview ? (
          <ImportPreviewChips
            leadLabel={preview.fileName}
            gameVersion={preview.gameVersion}
            loader={preview.loader}
            modCount={preview.modCount}
            sizeBytes={preview.fileSize}
          />
        ) : undefined
      }
      onClose={close}
      width="lg"
      footer={renderFooter()}
    >
      <div className="p-6 space-y-5">
        {isLoading || !preview ? (
          <div className="flex items-center gap-3 text-white/70 font-minecraft tracking-wide">
            <Icon icon="svg-spinners:ring-resize" className="w-5 h-5" />
            <span>{t("profiles.import.reading_pack")}</span>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="block text-lg font-smallcaps text-white mb-2">
                  {t("profiles.import.field_name")}
                </label>
                <SearchStyleInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("profiles.import.field_name_placeholder")}
                  className="text-sm w-full"
                />
              </div>

              <div className="flex flex-col">
                <label className="block text-lg font-smallcaps text-white mb-2">
                  {t("profiles.import.field_group")}
                </label>
                <GroupPicker value={group} onChange={setGroup} options={knownGroups} />
              </div>
            </div>

            <Checkbox
              label={t("profiles.import.norisk_toggle_title")}
              checked={useNoriskPack}
              onChange={(event) => setUseNoriskPack(event.target.checked)}
              size="lg"
            />

            <ImportTrustWarning />

            <ImportSecurityPanel
              security={preview.security}
              provenance={preview.provenance}
              executableContent={preview.executableContent}
            />

            <ImportRemovedList security={preview.security} />
          </>
        )}
      </div>
    </Modal>
  );
}

function LegacyGroupPicker({
  value,
  onChange,
  options,
  accentColor,
  t,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  accentColor: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [isTyping, setIsTyping] = useState(false);
  const showInput = isTyping || (value !== "" && !options.includes(value));

  const chipStyle = (active: boolean) =>
    active
      ? {
          borderColor: accentColor,
          backgroundColor: `${accentColor}30`,
          color: "#fff",
        }
      : {
          borderColor: "rgba(255,255,255,0.12)",
          backgroundColor: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.65)",
        };

  if (showInput) {
    return (
      <div className="flex items-center gap-2">
        <SearchStyleInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("placeholders.group_name")}
          className="text-sm w-full"
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            onChange("");
            setIsTyping(false);
          }}
          title={t("common.cancel")}
          className="shrink-0 p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-colors"
        >
          <Icon icon="solar:close-circle-linear" className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("")}
        className="px-3 py-1.5 rounded-lg border font-minecraft text-sm tracking-wide transition-colors"
        style={chipStyle(value === "")}
      >
        {t("profiles.import.group_none")}
      </button>

      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className="px-3 py-1.5 rounded-lg border font-minecraft text-sm tracking-wide transition-colors"
          style={chipStyle(value === option)}
        >
          {option}
        </button>
      ))}

      <button
        type="button"
        onClick={() => {
          onChange("");
          setIsTyping(true);
        }}
        className="px-3 py-1.5 rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 font-minecraft text-sm tracking-wide transition-colors flex items-center gap-1.5"
      >
        <Icon icon="solar:add-circle-linear" className="w-4 h-4" />
        {t("profiles.import.group_new")}
      </button>
    </div>
  );
}

function hasProvenanceFindings(preview: ImportPackPreview): boolean {
  return (
    preview.provenance.unknown.length > 0 ||
    preview.security.thirdPartyDownloadHosts.length > 0 ||
    preview.executableContent.scripts.length > 0 ||
    preview.executableContent.natives.length > 0
  );
}

function FileList({ paths }: { paths: string[] }) {
  return (
    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
      {paths.map((path, index) => (
        <li
          key={`${path}-${index}`}
          className="text-sm text-white/70 font-minecraft tracking-wide break-all"
        >
          {truncateEntry(path, 120)}
        </li>
      ))}
    </ul>
  );
}

function UnknownContentNotice({
  preview,
  t,
}: {
  preview: ImportPackPreview;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { unknown, verifiedCount, incomplete } = preview.provenance;
  const hosts = preview.security.thirdPartyDownloadHosts;
  const { scripts, natives, scriptCount, nativeCount } = preview.executableContent;

  return (
    <div className="rounded-md border-2 border-orange-500/40 bg-orange-500/10 p-3 space-y-4">
      {natives.length > 0 && (
        <div className="flex items-start gap-3">
          <Icon
            icon="solar:danger-triangle-bold"
            className="w-5 h-5 text-orange-300 shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-base text-white/85 font-minecraft tracking-wide">
              {t("profiles.import.natives_heading", { count: nativeCount })}
            </p>
            <p className="text-sm text-white/55 font-minecraft tracking-wide mt-1">
              {t("profiles.import.natives_explainer")}
            </p>
            <FileList paths={natives} />
          </div>
        </div>
      )}

      {scripts.length > 0 && (
        <div className="flex items-start gap-3">
          <Icon
            icon="solar:code-bold"
            className="w-5 h-5 text-orange-300 shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-base text-white/85 font-minecraft tracking-wide">
              {t("profiles.import.scripts_heading", { count: scriptCount })}
            </p>
            <p className="text-sm text-white/55 font-minecraft tracking-wide mt-1">
              {t("profiles.import.scripts_explainer")}
            </p>
            <FileList paths={scripts} />
          </div>
        </div>
      )}

      {hosts.length > 0 && (
        <div className="flex items-start gap-3">
          <Icon
            icon="solar:global-bold"
            className="w-5 h-5 text-orange-300 shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-base text-white/85 font-minecraft tracking-wide">
              {t("profiles.import.hosts_heading", { count: hosts.length })}
            </p>
            <p className="text-sm text-white/55 font-minecraft tracking-wide mt-1">
              {t("profiles.import.hosts_explainer")}
            </p>
            <FileList paths={hosts} />
          </div>
        </div>
      )}

      {unknown.length > 0 && (
        <div className="flex items-start gap-3">
          <Icon
            icon="solar:question-circle-bold"
            className="w-5 h-5 text-orange-300 shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-base text-white/85 font-minecraft tracking-wide">
              {t("profiles.import.unknown_heading", { count: unknown.length })}
            </p>
            <p className="text-sm text-white/55 font-minecraft tracking-wide mt-1">
              {incomplete
                ? t("profiles.import.unknown_lookup_failed")
                : t("profiles.import.unknown_explainer", { count: verifiedCount })}
            </p>
            <ul className="mt-2 space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {unknown.map((entry, index) => (
                <li
                  key={`${entry.name}-${index}`}
                  className="text-sm text-white/70 font-minecraft tracking-wide break-all"
                >
                  {truncateEntry(entry.name, 120)}
                  <span className="text-white/35">
                    {" - "}
                    {t(`profiles.import.unknown_reason_${entry.reason}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function packSubtitle(
  preview: ImportPackPreview,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return [
    truncate(preview.fileName, 44),
    [preview.gameVersion, preview.loader].filter(Boolean).join(" "),
    t("profiles.import.chip_mods", { count: preview.modCount }),
    formatBytes(preview.fileSize),
  ]
    .filter(Boolean)
    .join("  ·  ");
}

function buildRemovedList(
  preview: ImportPackPreview,
  t: (key: string, options?: Record<string, unknown>) => string,
): string[] {
  const report = preview.security;
  const removed: string[] = [];

  if (report.strippedJavaPath) {
    removed.push(t("profiles.import.removed_java_path"));
  }
  if (report.strippedJvmArgs || report.strippedGameArgs.length > 0) {
    removed.push(t("profiles.import.removed_launch_args"));
  }
  for (const mod of report.rejectedMods) {
    removed.push(
      t("profiles.import.removed_mod", { name: truncateEntry(mod.displayName, 120) }),
    );
  }
  for (const flag of report.strippedProfileFlags) {
    removed.push(t(`profiles.import.removed_flag_${flag}`));
  }

  return removed;
}
