import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./ui/input";
import { useI18n } from "./LocaleProvider";

/** Password field with a show/hide toggle. */
export function PasswordInput(props: Omit<React.ComponentProps<"input">, "type">) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t("login.hidePassword") : t("login.showPassword")}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
