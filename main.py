import asyncio
import os
from datetime import datetime

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import KeyboardButton, Message, ReplyKeyboardMarkup
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("Не найден TELEGRAM_BOT_TOKEN в .env файле")

bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Клавиатура
main_kb = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="/begin_deep_work"), KeyboardButton(text="/status")],
        [KeyboardButton(text="/end_deep_work")],
    ],
    resize_keyboard=True,
)

# user_id -> datetime начала сессии
user_timers: dict[int, datetime] = {}


class DeepWorkState(StatesGroup):
    working = State()


@dp.message(Command("start"))
async def start_command(message: Message):
    await message.reply(
        "Привет! Я бот для deep work. Используй кнопки ниже или команды.",
        reply_markup=main_kb,
    )


@dp.message(Command("begin_deep_work"))
async def begin_deep_work(message: Message, state: FSMContext):
    if message.from_user is None:
        await message.reply("Не удалось определить пользователя.")
        return

    user_id = message.from_user.id
    if user_id in user_timers:
        await message.reply("У тебя уже активная сессия deep work!")
        return

    user_timers[user_id] = datetime.now()
    await message.reply(
        "Сессия deep work начата! Фокусируйся на задаче. "
        "Используй /end_deep_work чтобы закончить."
    )
    await state.set_state(DeepWorkState.working)


@dp.message(Command("end_deep_work"))
async def end_deep_work(message: Message, state: FSMContext):
    if message.from_user is None:
        await message.reply("Не удалось определить пользователя.")
        return

    user_id = message.from_user.id
    if user_id not in user_timers:
        await message.reply("У тебя нет активной сессии deep work.")
        return

    start_time = user_timers.pop(user_id)
    duration = datetime.now() - start_time
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    await message.reply(
        f"Сессия deep work завершена! Время работы: {hours:02d}:{minutes:02d}:{seconds:02d}"
    )
    await state.clear()


@dp.message(Command("status"))
async def status_command(message: Message):
    if message.from_user is None:
        await message.reply("Не удалось определить пользователя.")
        return

    user_id = message.from_user.id
    if user_id not in user_timers:
        await message.reply("У тебя нет активной сессии deep work.")
        return

    elapsed = datetime.now() - user_timers[user_id]
    total_seconds = int(elapsed.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    await message.reply(f"Текущая сессия: {hours:02d}:{minutes:02d}:{seconds:02d} прошло.")


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

webapp_kb = InlineKeyboardMarkup(
    inline_keyboard=[
        [InlineKeyboardButton(
            text="Открыть Mini App",
            web_app=WebAppInfo(url="https://твой-сайт")
        )]
    ]
)

@dp.message(Command("app"))
async def open_app(message: Message):
    await message.answer("Открой приложение:", reply_markup=webapp_kb)

@dp.message()
async def handle_webapp(message: Message):
    if message.web_app_data:
        data = message.web_app_data.data
        await message.answer(f"Получено: {data}")