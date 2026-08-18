/**
 * Запуск емуляторів зі збереженням даних між перезапусками.
 *
 * За замовчуванням Emulator Suite тримає все в пам'яті: кожен перезапуск —
 * чистий аркуш, і тестові акаунти з профілями доводиться створювати наново.
 * Тут дані вивантажуються в `.emulator-data` при виході й підвантажуються
 * при старті.
 *
 * `--import` на неіснуючій теці валить CLI, тому перший запуск іде без
 * нього — тека з'явиться сама після першого коректного виходу (Ctrl+C).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const DATA_DIR = ".emulator-data";
const hasSnapshot = existsSync(`${DATA_DIR}/firebase-export-metadata.json`);

const args = ["firebase", "emulators:start", `--export-on-exit=${DATA_DIR}`];
if (hasSnapshot) args.push(`--import=${DATA_DIR}`);
else console.log(`i  ${DATA_DIR} порожня — стартуємо з чистої бази.`);

const child = spawn("npx", args, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
