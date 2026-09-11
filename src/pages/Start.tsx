import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useModules } from "../hooks/useModules";
import { calculateAllocation } from "../hooks/useQuiz";
import type { Module, QuizConfig } from "../types/quiz";
import { ModeSelector } from "../components/ModeSelector";
import { ModuleUploader } from "../components/ModuleUploader";
import { ModuleList } from "../components/ModuleList";
import { ModuleUploadModal } from "../components/ModuleUploadModal";
import { ArrowLeft, BookOpen, RefreshCw, Search, Trash2, UserRound } from "lucide-react";
import { PageHeader, PageShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { WorkspaceIdentity } from "../types/offline";
import { ApiError } from "../lib/api";

export function Start({ user }: { user: WorkspaceIdentity }) {
  const navigate = useNavigate();
  const {
    modules,
    usage,
    limits,
    loading,
    error: modulesError,
    online,
    pendingCount,
    syncErrors,
    conflicts,
    guestModules,
    addModules,
    updateModule,
    deleteModule,
    setSharing,
    publishModule,
    syncModule,
    syncAll,
    syncNow,
    resolveConflict,
    importGuestModules,
    subscribeByCode,
  } = useModules(user);
  const [config, setConfig] = useLocalStorage<QuizConfig>(
    `jayawijaya-config:${user.id}`,
    {
      selectedModuleIds: [],
      mode: "practice",
      randomize: false,
      distributionMode: "equal",
      timerEnabled: false,
      timerHours: 0,
      timerMinutes: 30,
      timerSeconds: 0,
    },
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [assignCategory, setAssignCategory] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [mutationError, setMutationError] = useState("");
  const [replacement, setReplacement] = useState<Module | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [guestImportIds, setGuestImportIds] = useState<string[] | null>(null);
  const [legacyModules, setLegacyModules] = useState<Module[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("jayawijaya-modules") ?? "[]");
    } catch {
      return [];
    }
  });
  const displayedLimits = {
    modules: limits.modules,
    storageMb: limits.storageBytes / 1024 / 1024,
  };

  const selectedGuestImportIds =
    guestImportIds ?? guestModules.map((module) => module.id);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    modules.forEach((m) => {
      if (m.categoryId) cats.add(m.categoryId);
    });
    return Array.from(cats).sort();
  }, [modules]);

  const filteredModules = useMemo(() => {
    if (!searchQuery) return modules;
    const query = searchQuery.toLowerCase();
    return modules.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.categoryId?.toLowerCase().includes(query),
    );
  }, [modules, searchQuery]);

  const handleUpload = useCallback(
    async (newModules: Module[]) => {
      setMutationError("");
      try {
        await addModules(newModules);
      } catch (reason) {
        setMutationError(
          reason instanceof Error ? reason.message : "Upload failed.",
        );
        throw reason;
      }
    },
    [addModules],
  );

  const handleSharing = useCallback(
    async (module: Module) => {
      try {
        await setSharing(module.id, module.visibility !== "live");
      } catch (reason) {
        setMutationError(
          reason instanceof Error ? reason.message : "Sharing update failed.",
        );
      }
    },
    [setSharing],
  );

  const handleSyncAll = useCallback(async () => {
    try {
      const updated = await syncAll();
      setSyncMessage(
        updated
          ? `${updated} module(s) updated.`
          : "Live modules are up to date.",
      );
    } catch (reason) {
      setMutationError(
        reason instanceof Error ? reason.message : "Update check failed.",
      );
    }
  }, [syncAll]);

  const handleLegacyImport = useCallback(async () => {
    const remaining: Module[] = [];
    for (const module of legacyModules) {
      try {
        await addModules([module]);
      } catch (reason) {
        if (!(reason instanceof ApiError && reason.code === "DUPLICATE_MODULE"))
          remaining.push(module);
      }
    }
    setLegacyModules(remaining);
    if (remaining.length === 0) localStorage.removeItem("jayawijaya-modules");
    else localStorage.setItem("jayawijaya-modules", JSON.stringify(remaining));
    if (remaining.length)
      setMutationError(
        `${legacyModules.length - remaining.length} imported; ${remaining.length} remain on this device.`,
      );
  }, [addModules, legacyModules]);

  const handleToggleModule = useCallback(
    (moduleId: string) => {
      setConfig((prev) => ({
        ...prev,
        selectedModuleIds: prev.selectedModuleIds.includes(moduleId)
          ? prev.selectedModuleIds.filter((id) => id !== moduleId)
          : [...prev.selectedModuleIds, moduleId],
      }));
    },
    [setConfig],
  );

  const handleToggleExpand = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  const handleDeleteModule = useCallback(
    (moduleId: string) => {
      void deleteModule(moduleId).catch((reason) =>
        setMutationError(
          reason instanceof Error ? reason.message : "Delete failed.",
        ),
      );
      setConfig((prev) => ({
        ...prev,
        selectedModuleIds: prev.selectedModuleIds.filter(
          (id) => id !== moduleId,
        ),
      }));
    },
    [deleteModule, setConfig],
  );

  const handleToggleCollapse = useCallback((key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(
    (moduleIds: string[], select: boolean) => {
      setConfig((prev) => ({
        ...prev,
        selectedModuleIds: select
          ? [...new Set([...prev.selectedModuleIds, ...moduleIds])]
          : prev.selectedModuleIds.filter((id) => !moduleIds.includes(id)),
      }));
    },
    [setConfig],
  );

  const handleMassAssign = useCallback(() => {
    if (!assignCategory) return;
    const finalCategory = assignCategory.startsWith("__new__:")
      ? assignCategory.slice(7)
      : assignCategory;
    void Promise.all(
      config.selectedModuleIds.map((id) =>
        updateModule(id, { categoryId: finalCategory }),
      ),
    ).catch((reason) =>
      setMutationError(
        reason instanceof Error ? reason.message : "Category update failed.",
      ),
    );
    setConfig((prev) => ({ ...prev, selectedModuleIds: [] }));
    setAssignCategory("");
  }, [assignCategory, config.selectedModuleIds, setConfig, updateModule]);

  const handleMassDelete = useCallback(() => {
    void Promise.all(config.selectedModuleIds.map(deleteModule)).catch(
      (reason) =>
        setMutationError(
          reason instanceof Error ? reason.message : "Delete failed.",
        ),
    );
    setConfig((prev) => ({ ...prev, selectedModuleIds: [] }));
  }, [config.selectedModuleIds, deleteModule, setConfig]);

  const handleStart = () => {
    if (config.selectedModuleIds.length === 0) return;

    const selectedModules = structuredClone(
      modules.filter((m) => config.selectedModuleIds.includes(m.id)),
    );
    const totalSeconds = config.timerEnabled
      ? config.timerHours * 3600 +
        config.timerMinutes * 60 +
        config.timerSeconds
      : 0;
    const runningState = {
      ownerId: user.id,
      modules: selectedModules,
      mode: config.mode,
      randomize: config.randomize,
      questionLimit: config.randomize ? config.questionLimit : undefined,
      distributionMode: config.randomize ? config.distributionMode : undefined,
      timerDuration: totalSeconds,
      timerStart: totalSeconds > 0 ? Date.now() : undefined,
    };
    navigate("/running", { state: runningState });
  };

  const totalQuestions = modules
    .filter((m) => config.selectedModuleIds.includes(m.id))
    .reduce((sum, m) => sum + m.questions.length, 0);

  const selectedModules = useMemo(
    () => modules.filter((m) => config.selectedModuleIds.includes(m.id)),
    [modules, config.selectedModuleIds],
  );

  const allocation = useMemo(() => {
    if (!config.randomize) return null;
    const limit = config.questionLimit ?? totalQuestions;
    if (limit >= totalQuestions) return null;
    return calculateAllocation(
      selectedModules,
      limit,
      config.distributionMode ?? "equal",
    );
  }, [
    config.randomize,
    config.questionLimit,
    config.distributionMode,
    selectedModules,
    totalQuestions,
  ]);

  useEffect(() => {
    setConfig((prev) => {
      if (!prev.randomize || totalQuestions <= 0) return prev;
      if (prev.questionLimit === undefined || prev.questionLimit === 0) {
        return { ...prev, questionLimit: totalQuestions };
      }
      const clamped = Math.min(prev.questionLimit, totalQuestions);
      if (clamped === prev.questionLimit) return prev;
      return { ...prev, questionLimit: clamped };
    });
  }, [totalQuestions, setConfig]);

  const hasSelection = config.selectedModuleIds.length > 0;

  const setRandomize = (checked: boolean) =>
    setConfig((prev) => ({
      ...prev,
      randomize: checked,
      questionLimit: checked
        ? (prev.questionLimit ?? totalQuestions)
        : prev.questionLimit,
    }));
  const timeField = (
    label: string,
    value: number,
    max: number,
    update: (v: number) => void,
  ) => (
    <div className="flex items-center gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        className="w-20"
        onChange={(e) =>
          update(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))
        }
      />
    </div>
  );
  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Quiz setup"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate("/account")}
              aria-label={user.kind === "account" ? "Account" : "Sign in"}
            >
              <UserRound />
              <span className="hidden sm:inline">
                {user.kind === "account" ? "Account" : "Sign in"}
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              aria-label="Back to home"
            >
              <ArrowLeft /> <span className="hidden sm:inline">Back</span>
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Mode</CardTitle>
          <CardDescription>
            {config.mode === "practice"
              ? "Answers are revealed after each submission."
              : "Answers are revealed after the exam."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModeSelector
            mode={config.mode}
            onChange={(mode) => setConfig((prev) => ({ ...prev, mode }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              Choose content for your quiz. {usage.moduleCount}/
              {displayedLimits.modules} modules ·{" "}
              {(usage.usedBytes / 1024 / 1024).toFixed(1)}/
              {displayedLimits.storageMb} MB
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!online || user.kind === "guest"}
              title={
                !online || user.kind === "guest"
                  ? "Requires a signed-in internet connection"
                  : undefined
              }
              onClick={() => void handleSyncAll()}
            >
              <RefreshCw /> Check updates
            </Button>
            <ModuleUploader
              onUpload={handleUpload}
              existingModules={modules}
              onImportCode={async (code) => { await subscribeByCode(code); }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.kind === "account" && pendingCount > 0 && (
            <Alert>
              <AlertTitle>Offline changes pending</AlertTitle>
              <AlertDescription className="mt-2 flex flex-wrap items-center gap-2">
                {pendingCount} change(s) waiting to sync.
                <Button size="sm" variant="secondary" disabled={!online} onClick={() => void syncNow()}>
                  Retry sync
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {syncErrors.map((message) => (
            <Alert key={message} variant="destructive">
              <AlertTitle>Sync needs attention</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ))}
          {user.kind === "account" && guestModules.length > 0 && (
            <Alert>
              <AlertTitle>Import guest modules</AlertTitle>
              <AlertDescription className="mt-3 space-y-3">
                <div className="space-y-2">
                  {guestModules.map((module) => (
                    <Label key={module.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedGuestImportIds.includes(module.id)}
                        onCheckedChange={(checked) =>
                          setGuestImportIds(
                            checked
                              ? [...selectedGuestImportIds, module.id]
                              : selectedGuestImportIds.filter(
                                  (id) => id !== module.id,
                                ),
                          )
                        }
                      />
                      {module.title}
                    </Label>
                  ))}
                </div>
                <Button
                  size="sm"
                  disabled={!selectedGuestImportIds.length}
                  onClick={() =>
                    void importGuestModules(selectedGuestImportIds)
                      .then((count) =>
                        setSyncMessage(`${count} guest module(s) imported.`),
                      )
                      .catch((reason) =>
                        setMutationError(
                          reason instanceof Error
                            ? reason.message
                            : "Import failed.",
                        ),
                      )
                  }
                >
                  Import selected
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories or module names"
              className="pl-9"
            />
          </div>
          {syncMessage && (
            <Alert>
              <AlertDescription>{syncMessage}</AlertDescription>
            </Alert>
          )}
          {(modulesError || mutationError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {modulesError || mutationError}
              </AlertDescription>
            </Alert>
          )}
          {conflicts.map((conflict) => (
            <Alert key={conflict.id} variant="destructive">
              <AlertTitle>
                Sync conflict:{" "}
                {conflict.localModule?.title ?? conflict.serverModule.title}
              </AlertTitle>
              <AlertDescription className="mt-2 flex flex-wrap gap-2">
                <span>This module changed locally and on the server.</span>
                <Button
                  size="sm"
                  onClick={() => void resolveConflict(conflict.id, "local")}
                >
                  Keep mine
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void resolveConflict(conflict.id, "server")}
                >
                  Use server
                </Button>
              </AlertDescription>
            </Alert>
          ))}
          {legacyModules.length > 0 && (
            <Alert>
              <AlertTitle>
                {legacyModules.length} module(s) found on this device
              </AlertTitle>
              <AlertDescription>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() => void handleLegacyImport()}
                >
                  Import modules
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {loading ? (
            <p>Loading modules…</p>
          ) : modules.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-3" />
              <p>No modules uploaded yet.</p>
              <Button
                variant="link"
                onClick={() => navigate("/how-to-create-modules")}
              >
                Open the module guide
              </Button>
            </div>
          ) : (
            <ModuleList
              modules={filteredModules}
              selectedIds={config.selectedModuleIds}
              expandedModules={expandedModules}
              collapsedCategories={collapsedCategories}
              cloudEnabled={online && user.kind === "account"}
              onToggleModule={handleToggleModule}
              onToggleExpand={handleToggleExpand}
              onDeleteModule={handleDeleteModule}
              onToggleCollapse={handleToggleCollapse}
              onToggleSelectAll={handleToggleSelectAll}
              onShare={(module) => void handleSharing(module)}
              onEdit={setReplacement}
              onSync={(id) => void syncModule(id)}
            />
          )}
          {hasSelection && (
            <Alert>
              <AlertTitle>
                {config.selectedModuleIds.length} modules selected
              </AlertTitle>
              <AlertDescription className="mt-3 flex flex-wrap gap-2">
                <Input
                  list="category-options"
                  value={assignCategory}
                  onChange={(e) => setAssignCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMassAssign()}
                  placeholder="Search or create category"
                  className="min-w-48 flex-1"
                />
                <datalist id="category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <Button variant="secondary" onClick={handleMassAssign} disabled={!assignCategory}>
                  Assign
                </Button>
                <Button variant="destructive" onClick={handleMassDelete}>
                  <Trash2 /> Delete selected
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      {replacement && (
        <ModuleUploadModal
          open
          onClose={() => setReplacement(null)}
          existingModules={modules}
          replacementFor={replacement}
          onUpload={async ([module]) => {
            await publishModule(replacement.id, module);
            setReplacement(null);
          }}
        />
      )}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Randomize questions</CardTitle>
            <CardDescription>
              Shuffle and optionally limit the selected questions.
            </CardDescription>
          </div>
          <Switch
            checked={config.randomize}
            onCheckedChange={setRandomize}
            aria-label="Randomize questions"
          />
        </CardHeader>
        {config.randomize && (
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="question-limit">Question limit</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="question-limit"
                  type="number"
                  min={1}
                  max={Math.max(totalQuestions, 1)}
                  value={config.questionLimit ?? totalQuestions}
                  className="w-28"
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value);
                    if (!isNaN(parsed))
                      setConfig((prev) => ({
                        ...prev,
                        questionLimit: Math.min(
                          Math.max(parsed, 1),
                          Math.max(totalQuestions, 1),
                        ),
                      }));
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  of {totalQuestions}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Distribution</Label>
              <RadioGroup
                value={config.distributionMode ?? "equal"}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    distributionMode: value as "equal" | "proportional",
                  }))
                }
                className="grid grid-cols-2 gap-3"
              >
                {(["equal", "proportional"] as const).map((value) => (
                  <Label
                    key={value}
                    className="flex items-center gap-2 rounded-md border p-3 has-data-[state=checked]:bg-accent"
                  >
                    <RadioGroupItem value={value} />
                    <span className="capitalize">{value}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {allocation ? (
              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-semibold">Question distribution</h3>
                {allocation.map(
                  ({ moduleId, allocated, originalAllocation }) => {
                    const mod = selectedModules.find((m) => m.id === moduleId);
                    if (!mod) return null;
                    return (
                      <div
                        key={moduleId}
                        className="flex justify-between border-b py-2 text-sm last:border-0"
                      >
                        <span>{mod.title}</span>
                        <span>
                          {allocated}{" "}
                          {allocated === 1 ? "question" : "questions"}
                          {originalAllocation !== allocated && (
                            <span className="text-muted-foreground">
                              {" "}
                              (from {originalAllocation})
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              <Alert>
                <AlertDescription>All questions selected.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Timer</CardTitle>
            <CardDescription>
              Automatically finish when time expires.
            </CardDescription>
          </div>
          <Switch
            checked={config.timerEnabled}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, timerEnabled: checked }))
            }
            aria-label="Enable timer"
          />
        </CardHeader>
        {config.timerEnabled && (
          <CardContent className="flex flex-wrap gap-4">
            {timeField("Hours", config.timerHours, 99, (v) =>
              setConfig((p) => ({ ...p, timerHours: v })),
            )}
            {timeField("Minutes", config.timerMinutes, 59, (v) =>
              setConfig((p) => ({ ...p, timerMinutes: v })),
            )}
            {timeField("Seconds", config.timerSeconds, 59, (v) =>
              setConfig((p) => ({ ...p, timerSeconds: v })),
            )}
          </CardContent>
        )}
      </Card>
      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
        <p className="font-medium">
          {config.selectedModuleIds.length} modules · {totalQuestions} questions
        </p>
        <Button size="lg" onClick={handleStart} disabled={!hasSelection}>
          Start quiz
        </Button>
      </div>
    </PageShell>
  );
}
