import * as XLSX from 'xlsx'
import * as cptable from 'xlsx/dist/cpexcel.full.mjs'

/**
 * SheetJS с таблицами кодировок.
 *
 * С 0.19 ESM-сборка xlsx (её берёт Next) идёт без таблиц кодировок: каждое
 * чтение с опцией codepage пишет в лог «Codepage tables are not loaded», а
 * файлы в однобайтовых кодировках (старые .xls) читались бы неверно.
 * Таблицы подключаются один раз здесь; импорт берёт XLSX отсюда.
 */
XLSX.set_cptable(cptable)

export { XLSX }
