import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Start } from "../../src/pages/Start";
import { ThemeProvider } from "../../src/components/theme-provider";
import type { Module } from "../../src/types/quiz";

const moduleState = vi.hoisted(() => ({
  module: null as Module | null,
  setSharing: vi.fn(),
}));

vi.mock("../../src/hooks/useModules", () => ({
  useModules: () => ({
    modules: moduleState.module ? [moduleState.module] : [],
    usage: { moduleCount: 1, usedBytes: 0 },
    limits: { modules: 10, storageBytes: 10_000_000 },
    loading: false,
    error: "",
    online: true,
    pendingCount: 0,
    syncErrors: [],
    conflicts: [],
    guestModules: [],
    addModules: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    setSharing: moduleState.setSharing,
    publishModule: vi.fn(),
    syncModule: vi.fn(),
    syncAll: vi.fn(),
    syncNow: vi.fn(),
    resolveConflict: vi.fn(),
    importGuestModules: vi.fn(),
    subscribeByCode: vi.fn(),
  }),
}));

vi.mock("../../src/hooks/useLocalStorage", () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}));

vi.mock("../../src/components/ModuleList", () => ({
  ModuleList: ({ modules, onShare }: { modules: Module[]; onShare: (module: Module) => void }) => (
    <button onClick={() => onShare(modules[0])}>Share test module</button>
  ),
}));

vi.mock("../../src/components/ModuleUploader", () => ({
  ModuleUploader: () => null,
}));

vi.mock("../../src/components/ModeSelector", () => ({
  ModeSelector: () => null,
}));

vi.mock("../../src/components/ShareModuleModal", () => ({
  ShareModuleModal: ({ url }: { url: string }) => (
    <div data-testid="share-modal">{url}</div>
  ),
}));

const user = { id: "user-1", kind: "account" as const };
const liveModule: Module = {
  id: "module-1",
  title: "Liver",
  questions: [],
  isOwner: true,
  visibility: "live",
  shareToken: "share-token",
};

const renderStart = () =>
  render(
    <MemoryRouter>
      <ThemeProvider defaultTheme="light">
        <Start user={user} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("Start module sharing", () => {
  beforeEach(() => {
    moduleState.module = liveModule;
    moduleState.setSharing.mockReset();
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses native sharing when it succeeds", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    renderStart();
    fireEvent.click(screen.getByRole("button", { name: "Share test module" }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "Liver",
        text: "Try the Liver quiz module",
        url: expect.stringMatching(/\/shared\/share-token$/),
      }),
    );
    expect(screen.queryByTestId("share-modal")).not.toBeInTheDocument();
  });

  it("opens the copy modal when native sharing fails", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("dismissed")),
    });

    renderStart();
    fireEvent.click(screen.getByRole("button", { name: "Share test module" }));

    expect(await screen.findByTestId("share-modal")).toHaveTextContent(
      /\/shared\/share-token$/,
    );
  });

  it("publishes a private module after confirmation before opening the modal", async () => {
    const privateModule = { ...liveModule, visibility: "private" as const, shareToken: undefined };
    const publishedModule = { ...privateModule, visibility: "live" as const, shareCode: "ABC123" };
    moduleState.module = privateModule;
    moduleState.setSharing.mockResolvedValue(publishedModule);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderStart();
    fireEvent.click(screen.getByRole("button", { name: "Share test module" }));

    await waitFor(() => expect(moduleState.setSharing).toHaveBeenCalledWith("module-1", true));
    expect(await screen.findByTestId("share-modal")).toHaveTextContent(
      /\/shared\/ABC123$/,
    );
  });
});
