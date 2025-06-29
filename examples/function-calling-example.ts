import { NeuroApi } from "../src/index";

const client = new NeuroApi({
  apiKey: process.env.NEUROAPI_KEY || "your-api-key",
  baseURL: "https://neuroapi.host/v1",
});

// Определяем инструменты
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Получить текущую погоду в указанном городе",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "Название города",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Единица измерения температуры",
          },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_tip",
      description: "Рассчитать чаевые",
      parameters: {
        type: "object",
        properties: {
          bill_amount: {
            type: "number",
            description: "Сумма счета",
          },
          tip_percentage: {
            type: "number",
            description: "Процент чаевых (по умолчанию 15%)",
            default: 15,
          },
        },
        required: ["bill_amount"],
      },
    },
  },
];

// Симуляция вызова функций
async function getWeather(city: string, unit: string = "celsius") {
  // Здесь был бы реальный API вызов к сервису погоды
  return {
    city,
    temperature: unit === "celsius" ? "22°C" : "72°F",
    condition: "Солнечно",
    humidity: "45%",
  };
}

async function calculateTip(billAmount: number, tipPercentage: number = 15) {
  const tipAmount = (billAmount * tipPercentage) / 100;
  const total = billAmount + tipAmount;
  return {
    bill_amount: billAmount,
    tip_percentage: tipPercentage,
    tip_amount: tipAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

async function handleFunctionCall(functionName: string, args: any) {
  switch (functionName) {
    case "get_weather":
      return await getWeather(args.city, args.unit);
    case "calculate_tip":
      return await calculateTip(args.bill_amount, args.tip_percentage);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

async function main() {
  console.log("🤖 Function Calling Example\n");

  try {
    // Первый запрос - пользователь просит погоду
    const response1 = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Какая сейчас погода в Москве?",
        },
      ],
      tools,
      tool_choice: "auto", // Позволяем модели самой решать когда использовать инструменты
    });

    console.log("Первый ответ:", response1.choices[0].message);

    if (response1.choices[0].message.tool_calls) {
      console.log("\n🔧 Модель хочет вызвать функции:");

      const toolCalls = response1.choices[0].message.tool_calls;
      const messages = [{ role: "user" as const, content: "Какая сейчас погода в Москве?" }, response1.choices[0].message];

      // Вызываем все функции
      for (const toolCall of toolCalls) {
        console.log(`- ${toolCall.function.name}(${toolCall.function.arguments})`);

        const args = JSON.parse(toolCall.function.arguments);
        const result = await handleFunctionCall(toolCall.function.name, args);

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }

      // Отправляем результаты обратно модели
      const response2 = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages as any,
      });

      console.log("\n🌤️ Финальный ответ с данными о погоде:");
      console.log(response2.choices[0].message.content);
    }

    console.log("\n" + "=".repeat(50) + "\n");

    // Второй пример - калькулятор чаевых
    const response3 = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Счет в ресторане составил 120 рублей. Сколько дать чаевых 18%?",
        },
      ],
      tools,
      tool_choice: "auto",
    });

    if (response3.choices[0].message.tool_calls) {
      console.log("💰 Расчет чаевых:");

      const toolCalls = response3.choices[0].message.tool_calls;
      const messages = [{ role: "user" as const, content: "Счет в ресторане составил 120 рублей. Сколько дать чаевых 18%?" }, response3.choices[0].message];

      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await handleFunctionCall(toolCall.function.name, args);

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }

      const response4 = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages as any,
      });

      console.log(response4.choices[0].message.content);
    }

    console.log("\n" + "=".repeat(50) + "\n");

    // Пример принудительного использования конкретной функции
    console.log("⚡ Принудительный вызов функции погоды:");

    const response5 = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Привет! Как дела?",
        },
      ],
      tools,
      tool_choice: {
        type: "function",
        function: { name: "get_weather" },
      },
    });

    console.log("Модель была принуждена использовать функцию погоды даже в обычном разговоре");
    console.log("Tool calls:", response5.choices[0].message.tool_calls);
  } catch (error) {
    console.error("❌ Ошибка:", error);
  }
}

// Запуск если файл исполняется напрямую
main();
