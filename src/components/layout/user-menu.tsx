// src/components/layout/user-menu.tsx
// Avatar ở góc trên-phải: mở menu Sửa hồ sơ / Trợ giúp / Đăng xuất.
"use client";

import { useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { LogOut, UserPen, LifeBuoy, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SUPPORT_EMAIL = "hoangtuanminh20072006@gmail.com";

interface Account {
  name: string;
  avatarUrl: string;
  birthDate: string;
  email: string;
}

export function UserMenu() {
  const { t } = useI18n();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [account, setAccount] = useState<Account>({ name: "", avatarUrl: "", birthDate: "", email: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      setAccount((await api.getAccount()) as Account);
    } catch {
      /* bỏ qua */
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  const displayName = account.name || user?.fullName || account.email || "User";
  const avatar = account.avatarUrl || user?.imageUrl || "";
  const initial = (displayName || "U").charAt(0).toUpperCase();

  async function save() {
    setSaving(true);
    try {
      await api.updateAccount({ name: account.name, avatarUrl: account.avatarUrl, birthDate: account.birthDate });
      setEditOpen(false);
      toast.success(t("account.saved"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("account.saveErr"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Account" className="h-9 w-9 overflow-hidden rounded-full border border-border bg-secondary">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold">{initial}</span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <UserPen className="mr-2 h-4 w-4" /> {t("menu.editProfile")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <LifeBuoy className="mr-2 h-4 w-4" /> {t("menu.help")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
            <LogOut className="mr-2 h-4 w-4" /> {t("menu.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sửa hồ sơ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("account.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-border bg-secondary">
                {account.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-semibold">{initial}</span>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("account.name")}</Label>
              <Input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("account.avatar")}</Label>
              <Input value={account.avatarUrl} placeholder="https://…"
                onChange={(e) => setAccount({ ...account, avatarUrl: e.target.value })} />
              <p className="text-xs text-muted-foreground">{t("account.avatarHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("account.birth")}</Label>
              <Input type="date" value={account.birthDate}
                onChange={(e) => setAccount({ ...account, birthDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trợ giúp */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("help.title")}</DialogTitle>
            <DialogDescription className="pt-2">{t("help.body")}</DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <span className="text-muted-foreground">{t("help.email")}: </span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline">{SUPPORT_EMAIL}</a>
          </div>
          <DialogFooter>
            <Button onClick={() => setHelpOpen(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
