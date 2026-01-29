const { exec } = require("child_process");
const { Command } = require("commander");
const path = require("path");
const fs = require("fs");

const { version } = require("./package.json");
const program = new Command();

program
  .name("dump-manager")
  .description("CLI to manage database dumps")
  .version(version);

program
  .command("mysql")
  .description("Manage mysql dumps")
  .argument("<host>", "The database ip/host")
  .argument("[port]", "The database port", 3306)
  .argument("<database>", "The name of the database to dump")
  .argument("<username>", "The username of the database to dump")
  .argument(
    "<password>",
    "The password of the username of the database to dump",
  )
  .argument("<dump folder>", "The folder where the dumps will be stored")
  .argument("[dump file name]", "The name of the dump file")
  .option("--repeat <number>", "Keep saving dumps, delay in seconds")
  .option("--keepCount <number>", "How many dumps should be kept", "3")
  .option("--ssl", "Should we use ssl to connect ?")
  .action(
    (
      host,
      port,
      database,
      username,
      password,
      dumpFolder,
      dumpFileName,
      opts,
    ) => {
      let dumpsToKeep;

      if (opts.keepCount) {
        try {
          dumpsToKeep = parseInt(opts.keepCount);
        } catch (err) {
          console.log(err);
          program.error("Invalid number of dumps to keep");
        }
      }

      saveDump(
        host,
        port,
        database,
        username,
        password,
        dumpFolder,
        dumpFileName,
        opts.ssl,
        opts.keepCount ? true : false,
        dumpsToKeep,
      );

      if (opts.repeat) {
        let dumpInterval;

        try {
          dumpInterval = parseInt(opts.repeat);
        } catch (err) {
          console.log(err);
          program.error("Invalid repeat delay");
        }

        setInterval(() => {
          saveDump(
            host,
            port,
            database,
            username,
            password,
            dumpFolder,
            dumpFileName,
            opts.ssl,
            opts.keepCount ? true : false,
            dumpsToKeep,
          );
        }, dumpInterval * 1000);
      }
    },
  );

program.parse(process.argv);

function saveDump(
  host,
  port,
  database,
  username,
  password,
  dumpFolder,
  dumpFileName,
  ssl,
  purgeDumps,
  keepCount,
) {
  let testCmd;

  if (process.platform === "win32") {
    testCmd = "where mysqldump";
  } else {
    testCmd = "which mysqldump";
  }

  exec(testCmd, async (error, stdout, stderr) => {
    if (error || !stdout.trim()) {
      program.error("mysqldump not found");
    } else {
      if (!dumpFileName) {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1);
        const day = String(now.getDate());
        const hours = String(now.getHours());
        const minutes = String(now.getMinutes());
        const seconds = String(now.getSeconds());

        dumpFileName = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
      }

      if (!dumpFileName.includes(".")) dumpFileName += ".sql";

      let dumpPath = path.join(dumpFolder, dumpFileName);

      if (!fs.existsSync(dumpFolder))
        fs.mkdirSync(dumpFolder, { recursive: true });

      if (fs.existsSync(dumpPath)) fs.rmSync(dumpPath);

      async function dump() {
        return new Promise((resolve, reject) => {
          exec(
            `mysqldump${ssl ? "" : " --skip-ssl"} -h "${host}" -P ${port} --password="${password}" -u "${username}" "${database}" > "${dumpPath}"`,
            (error, stdout, stderr) => {
              if (error) {
                program.error(`Dump error: ${error.message}`);
              }

              console.log("Dump saved to", dumpPath);
              resolve();
            },
          );
        });
      }

      await dump();

      const dumps = fs
        .readdirSync(dumpFolder, { withFileTypes: true })
        .filter((f) => f.isFile())
        .map((f) => f.name)
        .sort();

      if (purgeDumps && dumps.length + 1 > keepCount) {
        let count = 0;

        for (const dump of dumps) {
          const dumpToDeletePath = path.join(dumpFolder, dump);
          console.log(`Deleting ${dumpToDeletePath}`);
          fs.rmSync(dumpToDeletePath);

          count++;
          if (dumps.length - count <= keepCount) break;
        }
      }
    }
  });
}
