# Automated-PDF-Report-Generation-from-Jupyter-Notebook
# AutoReport

AutoReport is a Python program that automatically generates a PDF report from a Jupyter Notebook file (.ipynb). The report includes the project description, code cells, output cells, and markdown cells in the notebook.

## How to Use

1. Clone or download the AutoReport repository to your local machine.
2. Install the required dependencies using `pip install -r requirements.txt`.
3. Place your Jupyter Notebook file in the `input` directory.
4. Run the program using the command `python autoreport.py`.
5. The PDF report will be generated in the `output` directory.

## Dependencies

AutoReport requires the following dependencies:

- nbconvert
- jupyter
- pdfkit

These can be installed using the following command:

```
pip install -r requirements.txt
```

Note: PDFKit requires wkhtmltopdf to be installed on your system. You can download the appropriate version of wkhtmltopdf for your system from the official website: https://wkhtmltopdf.org/downloads.html

## Configuration

You can configure the program by editing the `config.py` file. You can change the file paths, report title, author name, and other settings.

## License

This project is licensed under the MIT License. See the LICENSE file for more information.

## Contact

If you have any questions or feedback, please contact me at [email address].
