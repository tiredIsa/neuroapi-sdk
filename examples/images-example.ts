import { NeuroApi } from "../src/index";
import { readFileSync, writeFileSync } from "fs";

async function main() {
  const client = new NeuroApi({
    apiKey: "api-key",
  });

  try {
    // Генерация изображения
    console.log("Генерация изображения...");
    const imageResponse = await client.images.generate({
      prompt: "A futuristic city with flying cars at sunset",
      model: "gpt-image-1",
    });

    console.log("Изображение создано:", imageResponse.data[0].url);
    if (imageResponse.data[0].revised_prompt) {
      console.log("Доработанный промпт:", imageResponse.data[0].revised_prompt);
    }

    // сохранить изображение в файл
    if (imageResponse.data[0].b64_json) {
      const imageBlob = Buffer.from(imageResponse.data[0].b64_json, "base64");
      writeFileSync("image.png", imageBlob);
    }

    // Генерация с метаданными
    console.log("\nГенерация с метаданными...");
    const responseWithMeta = await client.images.withResponse({
      prompt: "A peaceful forest scene with a small cabin",
      model: "gpt-image-1",
      size: "1536x1024",
    });

    console.log("Request ID:", responseWithMeta.requestId);
    console.log("Количество изображений:", responseWithMeta.data.data.length);

    // Редактирование изображения (требует файл)
    try {
      const imageFile = readFileSync("path/to/image.png");
      const maskFile = readFileSync("path/to/mask.png");

      const editResponse = await client.images.edit({
        image: new Blob([imageFile]),
        mask: new Blob([maskFile]),
        prompt: "Add a rainbow in the sky",
        model: "dall-e-2",
        size: "1024x1024",
        n: 1,
      });

      console.log("Отредактированное изображение:", editResponse.data[0].url);
    } catch (error) {
      console.log("Пропускаем редактирование - файлы не найдены");
    }

    // Создание вариации (требует файл)
    try {
      const imageFile = readFileSync("path/to/image.png");

      const variationResponse = await client.images.createVariation({
        image: new Blob([imageFile]),
        model: "dall-e-2",
        size: "1024x1024",
        n: 2,
      });

      console.log("Создано вариаций:", variationResponse.data.length);
    } catch (error) {
      console.log("Пропускаем создание вариаций - файл не найден");
    }

    // Получение base64 изображения
    console.log("\nПолучение base64 изображения...");
    const base64Response = await client.images.generate({
      prompt: "A simple geometric pattern",
      model: "dall-e-2",
      size: "256x256",
      response_format: "b64_json",
      n: 1,
    });

    if (base64Response.data[0].b64_json) {
      console.log("Base64 изображение получено (длина):", base64Response.data[0].b64_json.length);
    }
  } catch (error) {
    console.error("Ошибка:", error);
  }
}

main();
