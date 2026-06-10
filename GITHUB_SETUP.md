# 🔒 Настройка GitHub для коллабораторов — пошагово

> Этот файл — инструкции **для тебя как владельца** (@Abdurasul99).
> Делается **один раз** через GitHub web-UI. После — все правила автоматически
> применяются ко всем кто получает доступ.

---

## ✅ Что должно быть в итоге

1. `main` защищён — никто не может пушить напрямую (даже ты)
2. `develop` защищён слабее — можно push, но не force-push
3. Коллабратор имеет **Write** access — может пушить в свои feature-ветки
4. Коллабратор НЕ может изменять настройки репо
5. Слияние в `main` только через PR с твоим approval

---

## 📋 Шаги (15 минут)

### Шаг 1. Защита ветки `main`

Открой: **https://github.com/Abdurasul99/erp/settings/branches**

Нажми **Add branch protection rule** → ввести:

| Поле | Значение |
|---|---|
| Branch name pattern | `main` |
| ☑ Require a pull request before merging | ✅ включить |
| └ Require approvals | **1** approval |
| └ Dismiss stale pull request approvals when new commits are pushed | ✅ |
| ☑ Require status checks to pass before merging | (опционально — когда CI подключим) |
| ☑ Require conversation resolution before merging | ✅ |
| ☑ Require linear history | ✅ (запрещает merge-commits в main, заставляет squash или rebase) |
| ☐ Require signed commits | (опционально, если хочешь подписи) |
| ☑ Do not allow bypassing the above settings | ✅ — заставит даже тебя пройти PR |
| **Restrict who can push to matching branches** | ☑ включить, только `@Abdurasul99` (опц.) |
| ☑ Restrict force pushes | ✅ |
| ☑ Restrict deletions | ✅ |

Нажми **Create** или **Save changes**.

> ⚠️ Если включишь «Do not allow bypassing» — **сам ты тоже** не сможешь пушить напрямую в main без PR. Это рекомендуется. Если хочешь оставить себе бэкдор — отключи эту галочку.

---

### Шаг 2. Защита ветки `develop` (мягче)

То же что и `main`, но без некоторых galок:

| Поле | Значение |
|---|---|
| Branch name pattern | `develop` |
| ☑ Require a pull request before merging | ✅ |
| └ Require approvals | **1** |
| ☑ Restrict force pushes | ✅ |
| ☑ Restrict deletions | ✅ |
| ☐ Do not allow bypassing the above settings | **НЕ включай** — это даст тебе экстренный канал |

Нажми **Save changes**.

---

### Шаг 3. Pull Request settings репозитория

Открой: **https://github.com/Abdurasul99/erp/settings**
В блоке **«Pull Requests»** оставь только нужные галки:

- ☐ Allow merge commits → **отключить** (не нужно засорять историю)
- ☑ Allow squash merging → **включить** (один коммит на PR — чище)
- ☐ Allow rebase merging → отключить (на любителя)
- ☑ Always suggest updating pull request branches
- ☑ Automatically delete head branches → **включить** (после merge удалит feature-ветку)

В блоке **«Pushes»**:
- Default branch: `main`

---

### Шаг 4. Найти и пригласить коллабратора

#### А. Найти его username

Открой: **https://github.com/Abdurasul99?tab=repositories**

Прокликай свои репозитории — в каждом есть вкладка **Insights → Contributors**.
Там список всех кто коммитил. Найди того чей username начинается на «t».

Или открой **https://github.com/settings/notifications** — там могут остаться истории про @-меншены от него.

Или поищи свои старые PR/Issues где он был ревьюером:
**https://github.com/search?q=author%3AAbdurasul99+commenter%3At&type=issues**

#### Б. Пригласить в репо

Открой: **https://github.com/Abdurasul99/erp/settings/access**

Нажми **Add people** → ввести его GitHub username → выбрать роль:
- **Read** — только смотрит
- **Triage** — может assign / label issues
- ✅ **Write** — может push в ветки (НЕ main) → **выбери эту**
- **Maintain** — может менять некоторые настройки → **НЕ давай**
- **Admin** — полный контроль → **НИКОГДА не давай**

Нажми **Add to repository**. Он получит email-приглашение, должен accept в течение 7 дней.

---

### Шаг 5. Проверить что всё работает

После того как коллабратор accepted приглашение:

1. Пусть он у себя сделает:
   ```bash
   git clone -b develop https://github.com/Abdurasul99/erp.git wareapp
   cd wareapp
   git switch -c test/protection-check
   echo "// test" >> README.md
   git add README.md
   git commit -m "test: verify branch protection"
   git push -u origin test/protection-check
   ```
   → должно сработать (push в свою ветку OK)

2. Потом:
   ```bash
   git switch main
   git pull origin main
   echo "// hack" >> README.md
   git add README.md
   git commit -m "direct main push"
   git push origin main
   ```
   → должно **завернуться** с ошибкой `protected branch hook declined` (push в main запрещён)

3. Через GitHub UI он открывает PR из `test/protection-check` → base `develop`. Видишь PR в **https://github.com/Abdurasul99/erp/pulls**. Approve + merge → ветка автоматически удалится.

4. После проверки удали ветку `test/protection-check` (если осталась).

---

## 🔄 Когда коллабратор уходит

1. **https://github.com/Abdurasul99/erp/settings/access** → найти его → **Remove**
2. Закрыть его открытые PR-ы (или принять, если код хорош)
3. Удалить его feature-ветки с remote:
   ```bash
   # список его веток (предположим username — johndoe):
   git ls-remote --heads origin | grep -i johndoe
   # удалить:
   git push origin --delete feature/something
   ```
4. Если давал ему **dev** DeepSeek key — ревокни его в DeepSeek dashboard
5. Если он мог видеть что-то прод — пройди ротацию по `CREDENTIALS.md`

---

## 📊 Аудит — кто что делал

GitHub автоматически логирует всё. Смотри:

- **https://github.com/Abdurasul99/erp/network** — граф веток
- **https://github.com/Abdurasul99/erp/pulse** — pulse (последняя активность)
- **https://github.com/Abdurasul99/erp/graphs/contributors** — кто что коммитил
- **https://github.com/Abdurasul99?tab=audit-log** (только Pro/Team план) — детальный audit

---

## 🆘 Если что-то пошло не так

| Проблема | Решение |
|---|---|
| Коллабратор всё-таки запушил в main | Сразу `git revert <commit>` через PR; ротируй секреты если они уходили |
| Коллабратор force-pushed в свою ветку и потерял работу | `git reflog` на его машине, найти HEAD до force; если на remote — restore через `git push --force-with-lease` обратно из reflog |
| Случайно дал Admin вместо Write | Settings → Access → меняй уровень в любой момент |
| Branch protection не работает | Проверь что pattern точно `main` (не `master`, не `Main`) |
| Не приходят invite-email | Скажи ему чекнуть https://github.com/notifications → Invitations |

---

**Готово.** После этого ты спокойно работаешь — все защиты GitHub применяет сам.
